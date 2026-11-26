import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import {
  AiService,
  LlmError,
  type LlmFailure,
  type LlmUsage,
  type ReelBrand,
  type ReelBriefFacts,
  type ReelProduct,
} from '@/modules/ai';
import { MemoryService, type ReelContext } from '@/modules/memory';
import {
  briefOf,
  ideaDraftOf,
  restingStatus,
  type ProjectRow,
  PROJECT_INCLUDE,
} from './reel.mapper';
import { ReelTrendService } from './reel-trend.service';

export interface ReelJob {
  workspaceId: string;
  projectId: string;
}

const MESSAGES: Partial<Record<LlmFailure, string>> = {
  rate_limited: 'Many reels are being planned right now. Try again in a minute.',
  timeout: 'This took too long. Try again.',
  invalid_output: 'The AI could not come up with a usable answer this time. Try again.',
};
const SERVICE_DOWN = 'Reel planning is not available right now. Try again later.';
const GENERIC = 'Something went wrong. Try again.';
const ACCOUNT_FAILURES: ReadonlySet<LlmFailure> = new Set([
  'auth',
  'insufficient_credits',
  'unavailable',
  'no_provider',
]);

export function messageFor(error: unknown, generic: string = GENERIC): string {
  if (!(error instanceof LlmError)) return generic;
  if (ACCOUNT_FAILURES.has(error.reason)) return SERVICE_DOWN;
  return MESSAGES[error.reason] ?? generic;
}

export const usageData = (usage: LlmUsage) =>
  ({
    promptTokens: { increment: usage.promptTokens },
    completionTokens: { increment: usage.completionTokens },
    costUsd: { increment: usage.costUsd ?? 0 },
  }) satisfies Prisma.ReelProjectUpdateInput;

// The inputs every reel task shares, read from the reel and the Business Brain.
export interface ReelTaskInputs {
  brand: ReelBrand;
  product: ReelProduct;
  brief: ReelBriefFacts;
  context: ReelContext;
}

// Runs the slow reel steps (ideas, storyboard) in this process, as images do, and always
// leaves the reel resting with a message when a step fails.
@Injectable()
export class ReelJobRunner {
  private readonly logger = new Logger(ReelJobRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly memory: MemoryService,
    private readonly trends: ReelTrendService,
  ) {}

  start(job: ReelJob, step: (job: ReelJob) => Promise<void>): void {
    void step(job).catch((error: unknown) => this.fail(job, error));
  }

  readonly ideas = async (job: ReelJob): Promise<void> => {
    const project = await this.load(job);
    const inputs = await this.inputsFor(job.workspaceId, project);
    const trends = await this.trends.trendsFor(inputs.context);
    const avoidTitles = project.ideas.flatMap((i) => ideaDraftOf(i)?.title ?? []);
    const result = await this.ai.proposeReelIdeas({ ...inputs, trends, avoidTitles });
    const batch = Math.max(0, ...project.ideas.map((i) => i.batch)) + 1;

    await this.prisma.withTenant(job.workspaceId, async (tx) => {
      await tx.reelIdea.createMany({
        data: result.ideas.map((idea, position) => ({
          workspaceId: job.workspaceId,
          projectId: project.id,
          batch,
          position,
          content: idea,
          promptVersion: result.promptVersion,
        })),
      });
      await tx.reelProject.update({
        where: { id: project.id },
        data: { status: restingStatus(project), message: null, ...usageData(result.usage) },
      });
    });
  };

  storyboard(ideaId: string): (job: ReelJob) => Promise<void> {
    return async (job) => {
      const project = await this.load(job);
      const ideaRow = project.ideas.find((i) => i.id === ideaId);
      const idea = ideaRow ? ideaDraftOf(ideaRow) : null;
      if (!idea) throw new Error('The chosen idea could not be read');
      const inputs = await this.inputsFor(job.workspaceId, project);
      const result = await this.ai.writeReelStoryboard({ ...inputs, idea });

      // The new storyboard replaces any earlier one in one step, so a reel never shows half of each.
      await this.prisma.withTenant(job.workspaceId, async (tx) => {
        await tx.reelScene.deleteMany({ where: { projectId: project.id } });
        await tx.reelScene.createMany({
          data: result.storyboard.scenes.map((spec, position) => ({
            workspaceId: job.workspaceId,
            projectId: project.id,
            position,
            spec,
          })),
        });
        await tx.reelProject.update({
          where: { id: project.id },
          data: {
            status: 'storyboard_ready',
            chosenIdeaId: ideaId,
            cast: result.storyboard.cast,
            message: null,
            ...usageData(result.usage),
          },
        });
      });
    };
  }

  async inputsFor(workspaceId: string, project: ProjectRow): Promise<ReelTaskInputs> {
    const brief = briefOf(project);
    const context = await this.memory.reelContext(workspaceId, project.brandId, {
      productId: project.productId,
      objective: `A short video reel about ${project.productName}${brief.notes ? `: ${brief.notes}` : ''}`,
    });
    // The product may have been edited since; a removed one is still described by its name.
    const product: ReelProduct = context.product
      ? {
          name: context.product.name,
          description: context.product.description,
          price: context.product.price,
        }
      : { name: project.productName, description: null, price: null };
    return {
      brand: { name: context.brandName, contextText: context.contextText },
      product,
      brief: { ...brief, audience: brief.audience ?? context.audience },
      context,
    };
  }

  private async fail(job: ReelJob, error: unknown): Promise<void> {
    const detail =
      error instanceof LlmError
        ? `${error.reason}: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'unknown';
    this.logger.warn(`Reel ${job.projectId} step failed (${detail})`);
    await this.prisma.withTenant(job.workspaceId, async (tx) => {
      const project = await tx.reelProject.findUnique({ where: { id: job.projectId } });
      if (!project) return;
      await tx.reelProject.update({
        where: { id: project.id },
        data: { status: restingStatus(project), message: messageFor(error) },
      });
    });
  }

  private load(job: ReelJob): Promise<ProjectRow> {
    return this.prisma.withTenant(job.workspaceId, (tx) => findProject(tx, job.projectId));
  }
}

export async function findProject(tx: TenantTx, id: string): Promise<ProjectRow> {
  return tx.reelProject.findUniqueOrThrow({ where: { id }, include: PROJECT_INCLUDE });
}
