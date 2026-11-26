import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReelRender as RenderRow } from '@prisma/client';
import type { Env } from '@/config';
import { AssemblyPort } from '@/infra/media-assembly';
import { PrismaService } from '@/infra/prisma';
import { MediaStoragePort } from '@/infra/storage';
import { AssetsService } from '@/modules/assets';
import { generatedFolder } from '../../images/image-job.runner';
import { ideaOf } from '../reel.mapper';
import type { RenderInputs } from './assembly-inputs';
import { ReelSoundMaker } from './reel-sound.maker';

const TICK_MS = 5_000;
// Longer than any assembly takes (ffmpeg is killed after five minutes), so a held render is
// only taken over when its holder died.
const LEASE_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;
const FAILED = 'We could not put this reel together. Try again.';

// Assembles queued renders one at a time per server, claimed with a lease from the database,
// the same way clips are rendered (docs/REEL_STUDIO.md section 8). Turn it off on API
// instances with REEL_ASSEMBLY_ENABLED=false once a worker does it.
@Injectable()
export class AssemblyScanner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AssemblyScanner.name);
  private readonly enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly assembly: AssemblyPort,
    private readonly storage: MediaStoragePort,
    private readonly assets: AssetsService,
    private readonly soundMaker: ReelSoundMaker,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('REEL_ASSEMBLY_ENABLED', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled || !this.assembly.available) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  wake(): void {
    if (this.enabled && this.assembly.available) void this.tick();
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (let render = await this.claim(); render; render = await this.claim())
        await this.process(render);
    } catch (error) {
      this.logger.warn(
        `Assembly scan failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
    } finally {
      this.busy = false;
    }
  }

  // The connection role bypasses RLS for this scan across workspaces; writes use withTenant.
  private async claim(): Promise<RenderRow | null> {
    const now = new Date();
    const free = { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] };
    const candidate = await this.prisma.reelRender.findFirst({
      where: { status: { in: ['queued', 'running'] }, ...free },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const won = await this.prisma.reelRender.updateMany({
      where: { id: candidate.id, ...free },
      data: {
        status: 'running',
        leaseUntil: new Date(now.getTime() + LEASE_MS),
        attempts: { increment: 1 },
        startedAt: candidate.startedAt ?? now,
      },
    });
    return won.count === 1 ? { ...candidate, attempts: candidate.attempts + 1 } : this.claim();
  }

  private async process(render: RenderRow): Promise<void> {
    if (render.attempts > MAX_ATTEMPTS) {
      await this.update(render, {
        status: 'failed',
        message: FAILED,
        finishedAt: new Date(),
        leaseUntil: null,
      });
      return;
    }
    const started = Date.now();
    try {
      // Renders queued before sound existed have no `sound` plan.
      const inputs = render.inputs as unknown as Omit<RenderInputs, 'sound'> &
        Partial<Pick<RenderInputs, 'sound'>>;
      const made = await this.soundMaker.make(inputs.sound);
      const video = await this.assembly.assemble({ scenes: inputs.scenes }, made.sound);
      const stored = await this.storage.uploadVideo(
        { bytes: video.bytes },
        generatedFolder(render.workspaceId),
      );
      await this.prisma.withTenant(render.workspaceId, async (tx) => {
        const project = await tx.reelProject.findUniqueOrThrow({
          where: { id: render.projectId },
          include: { ideas: true },
        });
        const chosen = project.ideas.find((i) => i.id === project.chosenIdeaId);
        const assetId = await this.assets.recordReel(tx, {
          workspaceId: render.workspaceId,
          brandId: project.brandId,
          createdByUserId: render.createdByUserId,
          renderId: render.id,
          url: stored.url,
          name: `Reel: ${(chosen && ideaOf(chosen)?.title) ?? project.productName}`,
          width: stored.width ?? video.width,
          height: stored.height ?? video.height,
          durationSeconds: stored.durationSeconds ?? video.durationSeconds,
        });
        await tx.reelRender.update({
          where: { id: render.id },
          data: {
            status: 'succeeded',
            url: stored.url,
            durationSeconds: stored.durationSeconds ?? video.durationSeconds,
            assetId,
            message: null,
            finishedAt: new Date(),
            leaseUntil: null,
          },
        });
        if (made.costUsd > 0) {
          await tx.reelProject.update({
            where: { id: render.projectId },
            data: { costUsd: { increment: made.costUsd } },
          });
        }
      });
      this.logger.log(
        `Reel render ${render.id} assembled in ${Date.now() - started}ms (${video.bytes.length} bytes, music=${made.sound.music !== null}, voice lines=${made.sound.voice.length}, sound cost=${made.costUsd.toFixed(4)})`,
      );
    } catch (error) {
      this.logger.warn(
        `Reel render ${render.id} failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      const last = render.attempts >= MAX_ATTEMPTS;
      await this.update(render, {
        status: last ? 'failed' : 'queued',
        message: last ? FAILED : null,
        finishedAt: last ? new Date() : null,
        leaseUntil: null,
      });
    }
  }

  private async update(
    render: RenderRow,
    data: Parameters<PrismaService['reelRender']['update']>[0]['data'],
  ): Promise<void> {
    await this.prisma.withTenant(render.workspaceId, (tx) =>
      tx.reelRender.update({ where: { id: render.id }, data }),
    );
  }
}
