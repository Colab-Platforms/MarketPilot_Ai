import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ErrorCode, type ReelProject } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import {
  assertCanPlan,
  assertEditable,
  closeLost,
  readProject,
  type ReelActor,
} from '../reel-access';
import { ReelPresenter } from '../reel.presenter';
import { assemblyInputs } from './assembly-inputs';
import { AssemblyScanner } from './assembly.scanner';

const DAY_MS = 24 * 60 * 60_000;
// Assembly costs only server time, but it is real CPU; this keeps one workspace from hogging it.
const MAX_RENDERS_PER_DAY = 30;

// Queues the finished video for a reel. Clips are already paid for and assembly runs on our own
// server (ADR 0012); the scanner spends a few cents on music and voiceover (ADR 0013).
@Injectable()
export class ReelAssemblyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: AssemblyScanner,
    private readonly presenter: ReelPresenter,
  ) {}

  async assemble(actor: ReelActor, id: string, actionKey: string): Promise<ReelProject> {
    assertCanPlan(actor);
    if (!this.presenter.assemblyAvailable) {
      throw new DomainError(
        ErrorCode.Conflict,
        'Assembling reels is not set up on this server yet',
        409,
      );
    }
    const { workspaceId } = actor;
    const outcome = await this.prisma.withTenant(workspaceId, async (tx) => {
      await closeLost(tx);
      const row = await readProject(tx, id);
      if (row.lastActionKey === actionKey) return { row, queued: false };
      assertEditable(row);
      const inputs = assemblyInputs(row, this.presenter.soundAvailable);
      if ('blockedBy' in inputs) throw new DomainError(ErrorCode.Conflict, inputs.blockedBy, 409);

      const latest = row.renders[0];
      const busy = latest && (latest.status === 'queued' || latest.status === 'running');
      if (busy || (latest?.status === 'succeeded' && latest.inputsHash === inputs.hash)) {
        return { row, queued: false };
      }
      // The same reel assembled before (say, after an edit was undone) is reused, not rebuilt.
      const earlier = await tx.reelRender.findFirst({
        where: { projectId: id, inputsHash: inputs.hash, status: 'succeeded' },
        orderBy: { createdAt: 'desc' },
      });
      await assertWithinLimit(tx, workspaceId);
      await tx.reelRender.create({
        data: {
          workspaceId,
          projectId: id,
          createdByUserId: actor.userId,
          inputs: inputs.inputs as unknown as Prisma.InputJsonObject,
          inputsHash: inputs.hash,
          ...(earlier
            ? {
                status: 'succeeded',
                url: earlier.url,
                durationSeconds: earlier.durationSeconds,
                assetId: earlier.assetId,
                finishedAt: new Date(),
              }
            : {}),
        },
      });
      await tx.reelProject.update({ where: { id }, data: { lastActionKey: actionKey } });
      return { row: await readProject(tx, id), queued: !earlier };
    });
    if (outcome.queued) this.scanner.wake();
    return this.presenter.present(outcome.row);
  }
}

async function assertWithinLimit(tx: TenantTx, workspaceId: string): Promise<void> {
  const today = await tx.reelRender.count({
    where: { workspaceId, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
  });
  if (today >= MAX_RENDERS_PER_DAY) {
    throw new DomainError(
      ErrorCode.RateLimited,
      'You have assembled the most reels allowed today. Try again tomorrow',
      429,
    );
  }
}
