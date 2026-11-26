import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma';
import { MediaStoragePort, type StoredImage } from '@/infra/storage';
import { AiService, LlmError, type ImageBrief, type LlmFailure, type LlmUsage } from '@/modules/ai';
import { AssetsService } from '@/modules/assets';

export interface ImageJob {
  generationId: string;
  workspaceId: string;
  brief: ImageBrief;
  variants: number;
}

interface Produced extends StoredImage {
  mediaType: string;
  model: string;
  costUsd: number | null;
}

const FAILURE_MESSAGES: Partial<Record<LlmFailure, string>> = {
  rate_limited: 'Many images are being made right now. Try again in a minute.',
  timeout: 'The image took too long to make. Try again.',
  invalid_output: 'The image model could not make this image. Try describing it differently.',
};
const SERVICE_DOWN = 'Image creation is not available right now. Try again later.';
const GENERIC_FAILURE = 'We could not create the image. Try again.';
const ACCOUNT_FAILURES: ReadonlySet<LlmFailure> = new Set(['auth', 'insufficient_credits', 'unavailable', 'no_provider']);

export const generatedFolder = (workspaceId: string) => `marketpilot_generated/${workspaceId}`;

// Runs one image generation to the end in this process (no queue yet, like the website scan):
// every variant in parallel, each stored as soon as it exists, then the job is closed.
@Injectable()
export class ImageJobRunner {
  private readonly logger = new Logger(ImageJobRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: MediaStoragePort,
    private readonly assets: AssetsService,
  ) {}

  async run(job: ImageJob): Promise<void> {
    await this.prisma.withTenant(job.workspaceId, (tx) =>
      tx.studioGeneration.update({ where: { id: job.generationId }, data: { status: 'running', startedAt: new Date() } }),
    );

    // Usage is recorded as soon as a model answers, so a failed upload still shows what it cost.
    const spent: LlmUsage[] = [];
    const prompt: { text?: string; version?: string } = {};
    const results = await Promise.allSettled(
      Array.from({ length: job.variants }, async (_, index) => {
        const result = await this.ai.generateImage({ ...job.brief, option: { index, of: job.variants } });
        spent.push(result.usage);
        // Option 1's prompt is kept (others differ only by their fixed direction line); any
        // option's will do if the first one failed.
        if (index === 0 || !prompt.text) prompt.text = result.prompt;
        prompt.version = result.promptVersion;
        return this.store(job.workspaceId, result.image.bytes, result.image.mediaType, result.usage);
      }),
    );

    const produced = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []));
    for (const failure of failures) this.logFailure(job.generationId, failure);

    await this.prisma.withTenant(job.workspaceId, async (tx) => {
      const generation = await tx.studioGeneration.update({
        where: { id: job.generationId },
        data: {
          status: produced.length > 0 ? 'succeeded' : 'failed',
          prompt: prompt.text ?? null,
          promptVersion: prompt.version ?? null,
          promptTokens: spent.reduce((sum, u) => sum + u.promptTokens, 0),
          completionTokens: spent.reduce((sum, u) => sum + u.completionTokens, 0),
          costUsd: totalCost(spent),
          errorCode: failures.length > 0 ? failureCode(failures[0]) : null,
          message: closingMessage(produced.length, job.variants, failures[0]),
          finishedAt: new Date(),
        },
      });
      if (produced.length === 0) return;
      const outputs = await tx.studioOutput.createManyAndReturn({
        data: produced.map((p) => ({
          workspaceId: job.workspaceId,
          generationId: job.generationId,
          url: p.url,
          mediaType: p.mediaType,
          width: p.width,
          height: p.height,
          model: p.model,
          costUsd: p.costUsd,
        })),
      });
      await this.assets.recordGenerated(tx, {
        workspaceId: job.workspaceId,
        brandId: generation.brandId,
        createdByUserId: generation.createdByUserId,
        outputs,
      });
    });
  }

  // Closes a job that could not start, so the owner never sees it spin forever.
  async fail(workspaceId: string, generationId: string, error: unknown): Promise<void> {
    this.logFailure(generationId, error);
    await this.prisma.withTenant(workspaceId, (tx) =>
      tx.studioGeneration.updateMany({
        where: { id: generationId, status: { in: ['queued', 'running'] } },
        data: { status: 'failed', errorCode: failureCode(error), message: messageFor(error), finishedAt: new Date() },
      }),
    );
  }

  private async store(workspaceId: string, bytes: Buffer, mediaType: string, usage: LlmUsage): Promise<Produced> {
    const stored = await this.storage.uploadImage(bytes, mediaType, generatedFolder(workspaceId));
    return { ...stored, mediaType, model: usage.model, costUsd: usage.costUsd };
  }

  private logFailure(generationId: string, error: unknown): void {
    const detail = error instanceof LlmError ? `${error.reason}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
    this.logger.warn(`Image generation ${generationId} variant failed (${detail})`);
  }
}

function totalCost(usages: LlmUsage[]): number | null {
  const known = usages.flatMap((u) => (u.costUsd === null ? [] : [u.costUsd]));
  return known.length > 0 ? known.reduce((sum, c) => sum + c, 0) : null;
}

function failureCode(error: unknown): string {
  return error instanceof LlmError ? error.reason : 'storage';
}

function messageFor(error: unknown): string {
  if (!(error instanceof LlmError)) return GENERIC_FAILURE;
  if (ACCOUNT_FAILURES.has(error.reason)) return SERVICE_DOWN;
  return FAILURE_MESSAGES[error.reason] ?? GENERIC_FAILURE;
}

function closingMessage(made: number, asked: number, firstFailure: unknown): string | null {
  if (made === asked) return null;
  if (made === 0) return messageFor(firstFailure);
  return `We made ${made} of ${asked} images. ${messageFor(firstFailure)}`;
}
