import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  MAX_IDEA_BATCHES,
  type CreateReel,
  type ReelList,
  type ReelProject,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { AiService } from '@/modules/ai';
import { BrandProfileService } from '@/modules/brand';
import type { AuthPrincipal } from '@/modules/identity';
import { MemoryService } from '@/modules/memory';
import { assertCanPlan, closeLost, readProject, staleBefore, type ReelActor } from './reel-access';
import {
  PROJECT_INCLUDE,
  batchesOf,
  isResting,
  toReelSummary,
  type ProjectRow,
} from './reel.mapper';
import { ReelPresenter } from './reel.presenter';
import { ReelJobRunner } from './reel-job.runner';

const LIST_LIMIT = 30;
const DAY_MS = 24 * 60 * 60_000;
// A spend guard until credits exist. Planning is text only and costs cents, so the limits are loose.
const MAX_ACTIVE_PER_WORKSPACE = 2;
const MAX_NEW_REELS_PER_DAY = 20;

// A reel from brief to chosen idea: creating it, asking for more ideas, and choosing one,
// which writes the storyboard. Editing the storyboard is ReelStoryboardService.
@Injectable()
export class ReelProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly profiles: BrandProfileService,
    private readonly memory: MemoryService,
    private readonly runner: ReelJobRunner,
    private readonly presenter: ReelPresenter,
  ) {}

  get available(): boolean {
    return this.ai.available;
  }

  async create(actor: ReelActor, input: CreateReel, idempotencyKey: string): Promise<ReelProject> {
    assertCanPlan(actor);
    const { workspaceId } = actor;
    const replay = await this.prisma.withTenant(workspaceId, (tx) =>
      this.findByKey(tx, workspaceId, idempotencyKey),
    );
    if (replay) return this.presenter.present(replay);
    if (!this.available)
      throw new DomainError(
        ErrorCode.Conflict,
        'Reel planning is not set up for this workspace yet',
        409,
      );

    const brandId = await this.prisma.withTenant(workspaceId, (tx) =>
      this.profiles.brandIdOf(tx, workspaceId),
    );
    const context = await this.memory.reelContext(workspaceId, brandId, {
      productId: input.productId,
    });
    if (!context.product) {
      throw new DomainError(ErrorCode.Validation, 'That product was not found', 400, {
        fields: { productId: 'Choose one of your products' },
      });
    }

    let created: ProjectRow;
    try {
      created = await this.prisma.withTenant(workspaceId, async (tx) => {
        await this.assertWithinLimits(tx, workspaceId);
        return tx.reelProject.create({
          data: {
            workspaceId,
            brandId,
            createdByUserId: actor.userId,
            idempotencyKey,
            brief: input,
            productId: context.product?.id ?? null,
            productName: context.product?.name ?? '',
            productImageUrls: context.product?.imageUrls ?? [],
          },
          include: PROJECT_INCLUDE,
        });
      });
    } catch (error) {
      // Two requests with one key raced; the other one won and is the answer.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
        throw error;
      const winner = await this.prisma.withTenant(workspaceId, (tx) =>
        this.findByKey(tx, workspaceId, idempotencyKey),
      );
      if (!winner) throw error;
      return this.presenter.present(winner);
    }

    this.runner.start({ workspaceId, projectId: created.id }, this.runner.ideas);
    return this.presenter.present(created);
  }

  async list(principal: AuthPrincipal): Promise<ReelList> {
    const { workspaceId } = principal;
    const { rows, brandId } = await this.prisma.withTenant(workspaceId, async (tx) => {
      await closeLost(tx);
      return {
        rows: await tx.reelProject.findMany({
          orderBy: { createdAt: 'desc' },
          take: LIST_LIMIT,
          include: PROJECT_INCLUDE,
        }),
        brandId: await this.profiles.brandIdOf(tx, workspaceId),
      };
    });
    const context = await this.memory.reelContext(workspaceId, brandId, { productId: null });
    return {
      reels: rows.map(toReelSummary),
      available: this.available,
      defaults: { language: context.defaultLanguage, audience: context.audience },
    };
  }

  get(principal: AuthPrincipal, id: string): Promise<ReelProject> {
    return this.prisma.withTenant(principal.workspaceId, async (tx) => {
      await closeLost(tx);
      return this.presenter.present(await readProject(tx, id));
    });
  }

  // Another batch of ideas, kept alongside the earlier ones.
  async moreIdeas(actor: ReelActor, id: string, actionKey: string): Promise<ReelProject> {
    assertCanPlan(actor);
    const started = await this.beginStep(actor.workspaceId, id, actionKey, 'ideating', (row) => {
      if (batchesOf(row) >= MAX_IDEA_BATCHES) {
        throw new DomainError(
          ErrorCode.Conflict,
          'You have seen all the ideas for this reel. Start a new reel for fresh ones',
          409,
        );
      }
    });
    if (started.begun)
      this.runner.start({ workspaceId: actor.workspaceId, projectId: id }, this.runner.ideas);
    return this.presenter.present(started.row);
  }

  // Writes the storyboard for one idea. Choosing again replaces the storyboard once the new one is ready.
  async chooseIdea(
    actor: ReelActor,
    id: string,
    ideaId: string,
    actionKey: string,
  ): Promise<ReelProject> {
    assertCanPlan(actor);
    const started = await this.beginStep(
      actor.workspaceId,
      id,
      actionKey,
      'storyboarding',
      (row) => {
        if (!row.ideas.some((i) => i.id === ideaId))
          throw new DomainError(ErrorCode.NotFound, 'Idea not found', 404);
      },
    );
    if (started.begun) {
      this.runner.start(
        { workspaceId: actor.workspaceId, projectId: id },
        this.runner.storyboard(ideaId),
      );
    }
    return this.presenter.present(started.row);
  }

  // Moves a resting reel into a running step. A repeated key returns the reel as it is, so a
  // retried request never pays twice; a reel already busy cannot start a second step.
  private beginStep(
    workspaceId: string,
    id: string,
    actionKey: string,
    status: 'ideating' | 'storyboarding',
    check: (row: ProjectRow) => void,
  ): Promise<{ row: ProjectRow; begun: boolean }> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      await closeLost(tx);
      const row = await readProject(tx, id);
      if (row.lastActionKey === actionKey) return { row, begun: false };
      if (!isResting(row.status)) {
        throw new DomainError(
          ErrorCode.Conflict,
          'Wait for the current step to finish, then try again',
          409,
        );
      }
      check(row);
      const moved = await tx.reelProject.updateMany({
        where: { id, status: row.status },
        data: { status, lastActionKey: actionKey, message: null, stepStartedAt: new Date() },
      });
      if (moved.count === 0)
        throw new DomainError(
          ErrorCode.Conflict,
          'Wait for the current step to finish, then try again',
          409,
        );
      return { row: await readProject(tx, id), begun: true };
    });
  }

  private findByKey(
    tx: TenantTx,
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<ProjectRow | null> {
    return tx.reelProject.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } },
      include: PROJECT_INCLUDE,
    });
  }

  private async assertWithinLimits(tx: TenantTx, workspaceId: string): Promise<void> {
    const [active, today] = await Promise.all([
      tx.reelProject.count({
        where: {
          workspaceId,
          status: { in: ['ideating', 'storyboarding'] },
          stepStartedAt: { gt: staleBefore() },
        },
      }),
      tx.reelProject.count({
        where: { workspaceId, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
      }),
    ]);
    if (active >= MAX_ACTIVE_PER_WORKSPACE) {
      throw new DomainError(
        ErrorCode.RateLimited,
        'Wait for your current reels to finish planning, then try again',
        429,
      );
    }
    if (today >= MAX_NEW_REELS_PER_DAY) {
      throw new DomainError(
        ErrorCode.RateLimited,
        'You have started the most reels allowed today. Try again tomorrow',
        429,
      );
    }
  }
}
