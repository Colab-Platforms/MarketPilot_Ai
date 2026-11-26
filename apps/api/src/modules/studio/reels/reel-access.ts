import type { Prisma } from '@prisma/client';
import { ErrorCode, type WorkspaceRole } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { TenantTx } from '@/infra/prisma';
import { GENERATE_ROLES, type GenerationActor } from '../images/image-generation.service';
import { PROJECT_INCLUDE, type ProjectRow } from './reel.mapper';

const CAN_PLAN: ReadonlySet<WorkspaceRole> = new Set(GENERATE_ROLES);
// Steps run in this process. One still open after this was lost to a restart; a healthy
// trend search, idea or storyboard call finishes in well under five minutes.
const STALE_AFTER_MS = 10 * 60_000;
// Pictures queue three at a time behind each other, and each may fall back across three
// image models, so a whole reel's worth can take longer than one planning step.
const TAKE_STALE_AFTER_MS = 20 * 60_000;
const LOST_MESSAGE = 'This step was interrupted. Try again.';

export type ReelActor = GenerationActor;

export function assertCanPlan(actor: Pick<ReelActor, 'role'>): void {
  if (!CAN_PLAN.has(actor.role))
    throw new DomainError(ErrorCode.Forbidden, 'Your role cannot plan reels', 403);
}

export async function readProject(tx: TenantTx, id: string): Promise<ProjectRow> {
  const row = await tx.reelProject.findUnique({ where: { id }, include: PROJECT_INCLUDE });
  if (!row) throw new DomainError(ErrorCode.NotFound, 'Reel not found', 404);
  return row;
}

export function staleBefore(): Date {
  return new Date(Date.now() - STALE_AFTER_MS);
}

// A chosen idea means a storyboard exists, which is where an interrupted step returns to.
export async function closeLost(tx: TenantTx): Promise<void> {
  const lost: Prisma.ReelProjectWhereInput = {
    status: { in: ['ideating', 'storyboarding'] },
    stepStartedAt: { lt: staleBefore() },
  };
  await tx.reelProject.updateMany({
    where: { ...lost, chosenIdeaId: null },
    data: { status: 'ideas_ready', message: LOST_MESSAGE },
  });
  await tx.reelProject.updateMany({
    where: { ...lost, chosenIdeaId: { not: null } },
    data: { status: 'storyboard_ready', message: LOST_MESSAGE },
  });
  await tx.reelTake.updateMany({
    // Clips are not lost on restart: the provider keeps rendering and the clip scanner resumes them.
    where: {
      kind: { in: ['portrait', 'keyframe'] },
      status: { in: ['queued', 'running'] },
      createdAt: { lt: new Date(Date.now() - TAKE_STALE_AFTER_MS) },
    },
    data: { status: 'failed', errorCode: 'lost', message: LOST_MESSAGE, finishedAt: new Date() },
  });
}

export function assertEditable(row: ProjectRow): void {
  if (row.status !== 'storyboard_ready') {
    throw new DomainError(
      ErrorCode.Conflict,
      'Wait for the current step to finish, then edit the storyboard',
      409,
    );
  }
}
