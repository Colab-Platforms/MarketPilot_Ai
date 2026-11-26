import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ReelTake as TakeRow } from '@prisma/client';
import { PrismaService } from '@/infra/prisma';
import { MediaStoragePort } from '@/infra/storage';
import {
  LlmError,
  VideoService,
  type LlmFailure,
  type ReelClipBrief,
  type VideoDownload,
} from '@/modules/ai';
import { generatedFolder } from '../../images/image-job.runner';

const TICK_MS = 5_000;
// Long enough to submit, poll and copy one clip; a crashed holder's clips free up after it.
const LEASE_MS = 90_000;
const BATCH = 6;
// Clips take one to eight minutes; one still running after this is treated as lost by the provider.
const MAX_RUNNING_MS = 25 * 60_000;
const RETRY_LATER_MS = 30_000;

const SERVICE_DOWN = 'Video rendering is not available right now. Try again later.';
const MESSAGES: Partial<Record<LlmFailure | 'moderated', string>> = {
  moderated: 'The video model refused this keyframe. Try redrawing it.',
  timeout: 'This clip took too long to render. Try again.',
  auth: SERVICE_DOWN,
  insufficient_credits: SERVICE_DOWN,
  unavailable: SERVICE_DOWN,
};
const GENERIC = 'We could not render this clip. Try again.';

// Renders clips from the database, not a queue: each clip is a take holding its provider job id
// and when to look at it next (ARCHITECTURE.md section 7, "the DB is the schedule of record").
// Takes are claimed with a short lease, so any number of API instances can run this safely, and
// a restart loses nothing: the provider keeps rendering and the next tick picks the job up again.
@Injectable()
export class ClipScanner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ClipScanner.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private again = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly video: VideoService,
    private readonly storage: MediaStoragePort,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // Called after clips are queued, so the first submit does not wait for the next tick.
  wake(): void {
    void this.tick();
  }

  private async tick(): Promise<void> {
    if (this.ticking) {
      this.again = true;
      return;
    }
    this.ticking = true;
    try {
      do {
        this.again = false;
        const claimed = await this.claim();
        await Promise.all(claimed.map((take) => this.process(take)));
      } while (this.again);
    } catch (error) {
      this.logger.warn(`Clip scan failed (${error instanceof Error ? error.message : 'unknown'})`);
    } finally {
      this.ticking = false;
    }
  }

  // The connection role bypasses RLS, which a scan across workspaces needs. Every write below
  // goes through withTenant, so tenant isolation still holds for anything that changes.
  private async claim(): Promise<TakeRow[]> {
    const now = new Date();
    const free = { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] };
    const due = await this.prisma.reelTake.findMany({
      where: {
        kind: 'clip',
        status: { in: ['queued', 'running'] },
        pollAfter: { lte: now },
        ...free,
      },
      orderBy: { pollAfter: 'asc' },
      take: BATCH,
    });
    const claimed: TakeRow[] = [];
    for (const take of due) {
      const won = await this.prisma.reelTake.updateMany({
        where: { id: take.id, ...free },
        data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
      });
      if (won.count === 1) claimed.push(take);
    }
    return claimed;
  }

  private async process(take: TakeRow): Promise<void> {
    try {
      if (take.status === 'queued' || !take.providerJobId || !take.route) await this.submit(take);
      else await this.poll(take, take.route, take.providerJobId);
    } catch (error) {
      this.logger.warn(
        `Clip ${take.id} step failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      await this.update(take, {
        pollAfter: new Date(Date.now() + RETRY_LATER_MS),
        leaseUntil: null,
      });
    }
  }

  private async submit(take: TakeRow): Promise<void> {
    let submitted;
    try {
      submitted = await this.video.submitClip(
        take.inputs as unknown as ReelClipBrief,
        take.attempt,
        take.id,
      );
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      await this.fail(take, error.reason);
      return;
    }
    await this.update(take, {
      status: 'running',
      route: submitted.route,
      model: submitted.model,
      providerJobId: submitted.providerJobId,
      attempt: submitted.attempt,
      prompt: submitted.prompt,
      promptVersion: submitted.promptVersion,
      startedAt: take.startedAt ?? new Date(),
      pollAfter: new Date(Date.now() + 20_000),
      leaseUntil: null,
    });
  }

  private async poll(take: TakeRow, route: string, providerJobId: string): Promise<void> {
    if (take.startedAt && Date.now() - take.startedAt.getTime() > MAX_RUNNING_MS) {
      await this.moveOnOrFail(take, 'timeout');
      return;
    }
    const state = await this.video.checkClip(route, providerJobId);
    if (state.state === 'pending') {
      const elapsed = Date.now() - (take.startedAt ?? take.createdAt).getTime();
      await this.update(take, {
        pollAfter: new Date(Date.now() + (elapsed < 90_000 ? 10_000 : 20_000)),
        leaseUntil: null,
      });
      return;
    }
    if (state.state === 'failed') {
      this.logger.warn(`Clip ${take.id} failed on ${route} (${state.failure}: ${state.message})`);
      await this.moveOnOrFail(take, state.failure);
      return;
    }
    await this.finish(take, state.download, state.costUsd);
  }

  private async finish(
    take: TakeRow,
    download: VideoDownload,
    costUsd: number | null,
  ): Promise<void> {
    const stored = await this.storage.uploadVideo(download, generatedFolder(take.workspaceId));
    await this.prisma.withTenant(take.workspaceId, async (tx) => {
      await tx.reelTake.updateMany({
        where: { projectId: take.projectId, kind: 'clip', subject: take.subject, selected: true },
        data: { selected: false },
      });
      await tx.reelTake.update({
        where: { id: take.id },
        data: {
          status: 'succeeded',
          selected: true,
          url: stored.url,
          width: stored.width,
          height: stored.height,
          costUsd,
          finishedAt: new Date(),
          leaseUntil: null,
        },
      });
      await tx.reelProject.update({
        where: { id: take.projectId },
        data: { costUsd: { increment: costUsd ?? 0 } },
      });
    });
    this.logger.log(
      `Clip ${take.id} ready from ${take.route} in ${Math.round((Date.now() - (take.startedAt ?? take.createdAt).getTime()) / 1000)}s cost=${costUsd ?? 'n/a'}`,
    );
  }

  // A refusal or failure another route may not share moves the clip to the next VIDEO_MODELS entry.
  private async moveOnOrFail(take: TakeRow, failure: LlmFailure | 'moderated'): Promise<void> {
    if (!this.video.canMoveOn(take.attempt, failure)) {
      await this.fail(take, failure);
      return;
    }
    await this.update(take, {
      status: 'queued',
      attempt: take.attempt + 1,
      route: null,
      providerJobId: null,
      pollAfter: new Date(),
      leaseUntil: null,
    });
    this.wake();
  }

  private async fail(take: TakeRow, failure: LlmFailure | 'moderated'): Promise<void> {
    await this.update(take, {
      status: 'failed',
      errorCode: failure,
      message: MESSAGES[failure] ?? GENERIC,
      finishedAt: new Date(),
      leaseUntil: null,
    });
  }

  private async update(
    take: TakeRow,
    data: Parameters<PrismaService['reelTake']['update']>[0]['data'],
  ): Promise<void> {
    await this.prisma.withTenant(take.workspaceId, (tx) =>
      tx.reelTake.update({ where: { id: take.id }, data }),
    );
  }
}
