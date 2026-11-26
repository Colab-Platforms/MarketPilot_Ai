import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReelTake as TakeRow, ReelTakeKind } from '@prisma/client';
import { ErrorCode, type ReelProject, type ReelVisualKind } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { Env } from '@/config';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { MemoryService } from '@/modules/memory';
import {
  assertCanPlan,
  assertEditable,
  closeLost,
  readProject,
  type ReelActor,
} from '../reel-access';
import type { ProjectRow } from '../reel.mapper';
import { ReelPresenter } from '../reel.presenter';
import { ClipScanner } from './clip.scanner';
import { VisualRunner } from './visual.runner';
import {
  clipTargets,
  drawable,
  isSameDrawing,
  isUpToDate,
  keyframeTargets,
  portraitTargets,
  selectTake,
  type Candidate,
  type Target,
} from './visual-targets';

const DAY_MS = 24 * 60 * 60_000;
const KIND_OF: Record<ReelVisualKind, ReelTakeKind> = {
  portraits: 'portrait',
  keyframes: 'keyframe',
  clips: 'clip',
};

const candidatesFor = (kind: ReelTakeKind, row: ProjectRow): Candidate[] =>
  kind === 'portrait'
    ? portraitTargets(row)
    : kind === 'keyframe'
      ? keyframeTargets(row)
      : clipTargets(row);

// Portraits, keyframes and clips for a reel. Only what is missing or outdated is made; anything
// already made from the same details is reused for free.
@Injectable()
export class ReelVisualService {
  private readonly dailyImages: number;
  private readonly dailyVideoSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryService,
    private readonly runner: VisualRunner,
    private readonly clips: ClipScanner,
    private readonly presenter: ReelPresenter,
    config: ConfigService<Env, true>,
  ) {
    this.dailyImages = config.get('STUDIO_DAILY_REEL_IMAGE_LIMIT', { infer: true });
    this.dailyVideoSeconds = config.get('STUDIO_DAILY_REEL_VIDEO_SECONDS', { infer: true });
  }

  async drawMissing(
    actor: ReelActor,
    id: string,
    visualKind: ReelVisualKind,
    actionKey: string,
  ): Promise<ReelProject> {
    const kind = KIND_OF[visualKind];
    this.assertReady(actor, kind);
    const productImageUrls =
      kind === 'keyframe' ? await this.currentProductPhotos(actor.workspaceId, id) : null;
    return this.plan(actor, id, actionKey, async (tx, row) => {
      if (productImageUrls && productImageUrls.join('\n') !== row.productImageUrls.join('\n')) {
        await tx.reelProject.update({ where: { id }, data: { productImageUrls } });
        row.productImageUrls = productImageUrls;
      }
      return candidatesFor(kind, row)
        .map(drawable)
        .filter((t) => !isUpToDate(row, t));
    });
  }

  // Always a new one, even from the same details: the owner wants another option.
  redraw(
    actor: ReelActor,
    id: string,
    kind: ReelTakeKind,
    subject: string,
    actionKey: string,
  ): Promise<ReelProject> {
    this.assertReady(actor, kind);
    return this.plan(actor, id, actionKey, (_tx, row) => {
      const found = candidatesFor(kind, row).find((t) => t.subject === subject);
      if (!found) throw new DomainError(ErrorCode.NotFound, 'Nothing to make there', 404);
      return Promise.resolve([{ ...drawable(found), fresh: true }]);
    });
  }

  select(actor: ReelActor, id: string, takeId: string): Promise<ReelProject> {
    assertCanPlan(actor);
    return this.prisma.withTenant(actor.workspaceId, async (tx) => {
      const row = await readProject(tx, id);
      const take = row.takes.find((t) => t.id === takeId && t.status === 'succeeded');
      if (!take) throw new DomainError(ErrorCode.NotFound, 'Version not found', 404);
      await selectTake(tx, take);
      return this.presenter.present(await readProject(tx, id));
    });
  }

  private assertReady(actor: ReelActor, kind: ReelTakeKind): void {
    assertCanPlan(actor);
    const ready =
      kind === 'clip' ? this.presenter.videoAvailable : this.presenter.picturesAvailable;
    if (!ready) {
      const what = kind === 'clip' ? 'Rendering video' : 'Drawing pictures';
      throw new DomainError(
        ErrorCode.Conflict,
        `${what} is not set up for this workspace yet`,
        409,
      );
    }
  }

  private async currentProductPhotos(workspaceId: string, id: string): Promise<string[]> {
    const row = await this.prisma.withTenant(workspaceId, (tx) => readProject(tx, id));
    if (!row.productId) return row.productImageUrls;
    const context = await this.memory.reelContext(workspaceId, row.brandId, {
      productId: row.productId,
    });
    return context.product?.imageUrls ?? row.productImageUrls;
  }

  // Reuses a finished take with the same details where one exists and queues the rest. Pictures
  // start drawing once the transaction commits; clips are picked up by the clip scanner. A
  // repeated key changes nothing.
  private async plan(
    actor: ReelActor,
    id: string,
    actionKey: string,
    choose: (tx: TenantTx, row: ProjectRow) => Promise<(Target & { fresh?: boolean })[]>,
  ): Promise<ReelProject> {
    const { workspaceId } = actor;
    const outcome = await this.prisma.withTenant(workspaceId, async (tx) => {
      await closeLost(tx);
      const row = await readProject(tx, id);
      if (row.lastActionKey === actionKey) return { row, queued: [] as TakeRow[] };
      assertEditable(row);
      const targets = await choose(tx, row);
      const busy = new Set(
        row.takes
          .filter((t) => t.status === 'queued' || t.status === 'running')
          .map((t) => `${t.kind}:${t.subject}`),
      );
      if (targets.some((t) => t.fresh && busy.has(`${t.kind}:${t.subject}`))) {
        throw new DomainError(ErrorCode.Conflict, 'This is already being made', 409);
      }

      const toMake: Target[] = [];
      for (const target of targets.filter((t) => !busy.has(`${t.kind}:${t.subject}`))) {
        const reusable = target.fresh ? undefined : row.takes.find((t) => isSameDrawing(t, target));
        if (reusable) await selectTake(tx, reusable);
        else toMake.push(target);
      }
      await this.assertWithinLimits(tx, workspaceId, toMake);
      const queued: TakeRow[] = [];
      for (const t of toMake) {
        queued.push(
          await tx.reelTake.create({
            data: {
              workspaceId,
              projectId: id,
              createdByUserId: actor.userId,
              kind: t.kind,
              subject: t.subject,
              inputs: t.inputs,
              inputsHash: t.hash,
              ...(t.kind === 'clip' && {
                durationSeconds: t.seconds ?? null,
                pollAfter: new Date(),
              }),
            },
          }),
        );
      }
      await tx.reelProject.update({ where: { id }, data: { lastActionKey: actionKey } });
      return { row: await readProject(tx, id), queued };
    });
    const pictures = outcome.queued.filter((t) => t.kind !== 'clip');
    if (pictures.length > 0) this.runner.start(workspaceId, pictures);
    if (pictures.length < outcome.queued.length) this.clips.wake();
    return this.presenter.present(outcome.row);
  }

  // Spend guards until credits exist: pictures by count, video by rendered seconds.
  private async assertWithinLimits(
    tx: TenantTx,
    workspaceId: string,
    adding: Target[],
  ): Promise<void> {
    const since = new Date(Date.now() - DAY_MS);
    const newPictures = adding.filter((t) => t.kind !== 'clip').length;
    const newSeconds = adding.reduce((sum, t) => sum + (t.seconds ?? 0), 0);
    if (newPictures > 0) {
      const drawn = await tx.reelTake.count({
        where: {
          workspaceId,
          kind: { in: ['portrait', 'keyframe'] },
          status: { not: 'failed' },
          createdAt: { gt: since },
        },
      });
      if (drawn + newPictures > this.dailyImages) {
        const left = Math.max(this.dailyImages - drawn, 0);
        throw new DomainError(
          ErrorCode.RateLimited,
          `You can draw ${left} more reel pictures today. Try again tomorrow`,
          429,
        );
      }
    }
    if (newSeconds > 0) {
      const rendered = await tx.reelTake.aggregate({
        where: { workspaceId, kind: 'clip', status: { not: 'failed' }, createdAt: { gt: since } },
        _sum: { durationSeconds: true },
      });
      const used = rendered._sum.durationSeconds ?? 0;
      if (used + newSeconds > this.dailyVideoSeconds) {
        const left = Math.max(Math.floor(this.dailyVideoSeconds - used), 0);
        throw new DomainError(
          ErrorCode.RateLimited,
          `You can render ${left} more seconds of video today. Try again tomorrow`,
          429,
        );
      }
    }
  }
}
