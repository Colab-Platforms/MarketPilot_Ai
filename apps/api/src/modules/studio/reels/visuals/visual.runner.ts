import { Injectable, Logger } from '@nestjs/common';
import type { ReelTake as TakeRow } from '@prisma/client';
import { PrismaService } from '@/infra/prisma';
import { MediaStoragePort } from '@/infra/storage';
import { AiService, LlmError, type ReelKeyframeBrief, type ReelPortraitBrief } from '@/modules/ai';
import { generatedFolder } from '../../images/image-job.runner';
import { messageFor } from '../reel-job.runner';

// Enough to finish a reel's pictures quickly without flooding the image models.
const CONCURRENCY = 3;

// Draws queued takes in this process (as images do), a few at a time. Each success becomes
// the selected picture for its subject; each failure keeps its message for the owner.
@Injectable()
export class VisualRunner {
  private readonly logger = new Logger(VisualRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: MediaStoragePort,
  ) {}

  start(workspaceId: string, takes: TakeRow[]): void {
    const queue = [...takes];
    const worker = async () => {
      for (let take = queue.shift(); take; take = queue.shift()) await this.draw(workspaceId, take);
    };
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i += 1) void worker();
  }

  private async draw(workspaceId: string, take: TakeRow): Promise<void> {
    try {
      await this.prisma.withTenant(workspaceId, (tx) =>
        tx.reelTake.update({
          where: { id: take.id },
          data: { status: 'running', startedAt: new Date() },
        }),
      );
      const result =
        take.kind === 'portrait'
          ? await this.ai.generateReelPortrait(take.inputs as unknown as ReelPortraitBrief)
          : await this.ai.generateReelKeyframe(take.inputs as unknown as ReelKeyframeBrief);
      const stored = await this.storage.uploadImage(
        result.image.bytes,
        result.image.mediaType,
        generatedFolder(workspaceId),
      );

      await this.prisma.withTenant(workspaceId, async (tx) => {
        await tx.reelTake.updateMany({
          where: {
            projectId: take.projectId,
            kind: take.kind,
            subject: take.subject,
            selected: true,
          },
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
            model: result.usage.model,
            prompt: result.prompt,
            promptVersion: result.promptVersion,
            costUsd: result.usage.costUsd,
            finishedAt: new Date(),
          },
        });
        await tx.reelProject.update({
          where: { id: take.projectId },
          data: {
            promptTokens: { increment: result.usage.promptTokens },
            completionTokens: { increment: result.usage.completionTokens },
            costUsd: { increment: result.usage.costUsd ?? 0 },
          },
        });
      });
    } catch (error) {
      const detail =
        error instanceof LlmError
          ? `${error.reason}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'unknown';
      this.logger.warn(`Reel ${take.kind} ${take.id} failed (${detail})`);
      await this.prisma
        .withTenant(workspaceId, (tx) =>
          tx.reelTake.update({
            where: { id: take.id },
            data: {
              status: 'failed',
              errorCode: error instanceof LlmError ? error.reason : 'storage',
              message: messageFor(error, 'We could not draw this picture. Try again.'),
              finishedAt: new Date(),
            },
          }),
        )
        .catch((closeError: unknown) => {
          this.logger.error(
            `Could not record the failure of take ${take.id}: ${closeError instanceof Error ? closeError.message : 'unknown'}`,
          );
        });
    }
  }
}
