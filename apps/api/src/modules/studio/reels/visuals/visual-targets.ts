import type { Prisma, ReelTake as TakeRow, ReelTakeKind } from '@prisma/client';
import { ErrorCode } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { TenantTx } from '@/infra/prisma';
import { clipSeconds } from '@/modules/ai';
import { castOf, sceneOf, type ProjectRow } from '../reel.mapper';
import {
  clipBrief,
  clipHash,
  keyframeBrief,
  keyframeHash,
  portraitBrief,
  portraitHash,
} from './take-briefs';
import { portraitUrlsOf, productOf, selectedTake, takesBySubject } from './visuals.mapper';

// What could be drawn or rendered for one subject, and exactly from what.
export interface Target {
  kind: ReelTakeKind;
  subject: string;
  inputs: Prisma.InputJsonValue;
  hash: string;
  // Clips only: the seconds the video model will render, which is what a clip costs.
  seconds?: number;
}

// A subject that cannot be drawn yet because what it is drawn from is missing.
interface Blocked {
  kind: ReelTakeKind;
  subject: string;
  blockedBy: string;
}

export type Candidate = Target | Blocked;

export function portraitTargets(row: ProjectRow): Candidate[] {
  return castOf(row).map((c) => {
    const brief = portraitBrief(c);
    return { kind: 'portrait', subject: c.id, inputs: { ...brief }, hash: portraitHash(brief) };
  });
}

// Keyframes are drawn from portraits, so a scene with someone not yet drawn cannot be drawn.
export function keyframeTargets(row: ProjectRow): Candidate[] {
  const cast = castOf(row);
  const portraits = portraitUrlsOf(row);
  const product = productOf(row);
  return scenesOf(row).map((scene): Candidate => {
    const brief = keyframeBrief(scene, cast, portraits, product);
    if (!brief)
      return {
        kind: 'keyframe',
        subject: scene.id,
        blockedBy: 'Draw a portrait for everyone in the cast first',
      };
    return { kind: 'keyframe', subject: scene.id, inputs: { ...brief }, hash: keyframeHash(brief) };
  });
}

// Clips animate keyframes, so a scene needs an up-to-date keyframe before it can be rendered:
// paying for video of an outdated picture would be wasted.
export function clipTargets(row: ProjectRow): Candidate[] {
  const keyframes = takesBySubject(row, 'keyframe');
  const expectedKeyframes = new Map(
    keyframeTargets(row).flatMap((t) => ('hash' in t ? [[t.subject, t.hash] as const] : [])),
  );
  return scenesOf(row).map((scene): Candidate => {
    const keyframe = selectedTake(keyframes.get(scene.id));
    if (!keyframe || keyframe.inputsHash !== expectedKeyframes.get(scene.id)) {
      return {
        kind: 'clip',
        subject: scene.id,
        blockedBy: 'Draw the keyframes before rendering clips',
      };
    }
    const brief = clipBrief(scene, keyframe.url);
    return {
      kind: 'clip',
      subject: scene.id,
      inputs: { ...brief },
      hash: clipHash(brief),
      seconds: clipSeconds(brief),
    };
  });
}

export function drawable(candidate: Candidate): Target {
  if ('blockedBy' in candidate) throw new DomainError(ErrorCode.Conflict, candidate.blockedBy, 409);
  return candidate;
}

export function isUpToDate(row: ProjectRow, target: Target): boolean {
  return (
    selectedTake(takesBySubject(row, target.kind).get(target.subject))?.inputsHash === target.hash
  );
}

export const isSameDrawing = (take: TakeRow, target: Target) =>
  take.status === 'succeeded' &&
  take.kind === target.kind &&
  take.subject === target.subject &&
  take.inputsHash === target.hash;

export async function selectTake(tx: TenantTx, take: TakeRow): Promise<void> {
  await tx.reelTake.updateMany({
    where: { projectId: take.projectId, kind: take.kind, subject: take.subject, selected: true },
    data: { selected: false },
  });
  await tx.reelTake.update({ where: { id: take.id }, data: { selected: true } });
}

function scenesOf(row: ProjectRow) {
  return row.scenes.flatMap((sceneRow) => {
    const scene = sceneOf(sceneRow);
    return scene ? [scene] : [];
  });
}
