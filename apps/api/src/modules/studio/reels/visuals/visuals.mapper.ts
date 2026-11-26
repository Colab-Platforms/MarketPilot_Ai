import type { ReelTake as TakeRow, ReelTakeKind } from '@prisma/client';
import type { ReelTake, ReelVisual, ReelVisuals } from '@marketpilot/contracts';
import { castOf, sceneOf, type ProjectRow } from '../reel.mapper';
import { MIN_CLIP_SECONDS } from '@/modules/ai';
import {
  clipBrief,
  clipHash,
  keyframeBrief,
  keyframeHash,
  portraitBrief,
  portraitHash,
  type ProductForPictures,
} from './take-briefs';

// What one picture costs on the configured image models (ADR 0011 spike: $0.040-0.046).
export const IMAGE_COST_USD = 0.045;
// Kling 3.0 Standard on OpenRouter, 720p without audio (ADR 0011). The Higgsfield fallback
// costs about twice this; the estimate is for the main route.
export const VIDEO_COST_PER_SECOND_USD = 0.084;
// Measured 2026-11-20: a 3-second Kling clip on OpenRouter was billed $0.42, the same as 5 seconds.
export const VIDEO_MIN_BILLED_SECONDS = 5;
const HISTORY = 6;
const DEFAULT_FAILURE = 'We could not draw this picture. Try again.';

const isOpen = (t: TakeRow) => t.status === 'queued' || t.status === 'running';
const isDone = (t: TakeRow): t is TakeRow & { url: string } =>
  t.status === 'succeeded' && t.url !== null;
const view = (t: TakeRow & { url: string }): ReelTake => ({
  id: t.id,
  url: t.url,
  createdAt: t.createdAt.toISOString(),
});

// Takes of one kind grouped by subject, newest first (the include orders them that way).
export function takesBySubject(row: ProjectRow, kind: ReelTakeKind): Map<string, TakeRow[]> {
  const groups = new Map<string, TakeRow[]>();
  for (const take of row.takes) {
    if (take.kind !== kind) continue;
    groups.set(take.subject, [...(groups.get(take.subject) ?? []), take]);
  }
  return groups;
}

export function selectedTake(takes: TakeRow[] | undefined): (TakeRow & { url: string }) | null {
  return takes?.filter(isDone).find((t) => t.selected) ?? null;
}

// The portrait each cast member is drawn from in keyframes: the one the owner has selected.
export function portraitUrlsOf(row: ProjectRow): Map<string, string> {
  const urls = new Map<string, string>();
  for (const [subject, takes] of takesBySubject(row, 'portrait')) {
    const take = selectedTake(takes);
    if (take) urls.set(subject, take.url);
  }
  return urls;
}

export const productOf = (row: ProjectRow): ProductForPictures => ({
  name: row.productName,
  imageUrls: row.productImageUrls,
});

function slot(subject: string, takes: TakeRow[], expectedHash: string | null): ReelVisual {
  const current = selectedTake(takes);
  const latest = takes[0];
  return {
    subject,
    current: current ? view(current) : null,
    // No expected hash means the picture can no longer be drawn as is (someone lost a portrait).
    outdated: current !== null && current.inputsHash !== expectedHash,
    drawing: takes.some(isOpen),
    failure: latest?.status === 'failed' ? (latest.message ?? DEFAULT_FAILURE) : null,
    takes: takes.filter(isDone).slice(0, HISTORY).map(view),
  };
}

export interface VisualsAvailability {
  pictures: boolean;
  video: boolean;
}

export function toVisuals(row: ProjectRow, availability: VisualsAvailability): ReelVisuals {
  const cast = castOf(row);
  const portraits = takesBySubject(row, 'portrait');
  const keyframes = takesBySubject(row, 'keyframe');
  const clips = takesBySubject(row, 'clip');
  const portraitUrls = portraitUrlsOf(row);
  const product = productOf(row);
  const scenes = row.scenes.flatMap((sceneRow) => {
    const scene = sceneOf(sceneRow);
    return scene ? [scene] : [];
  });
  return {
    portraits: cast.map((c) =>
      slot(c.id, portraits.get(c.id) ?? [], portraitHash(portraitBrief(c))),
    ),
    keyframes: scenes.map((scene) => {
      const brief = keyframeBrief(scene, cast, portraitUrls, product);
      return slot(scene.id, keyframes.get(scene.id) ?? [], brief ? keyframeHash(brief) : null);
    }),
    clips: scenes.map((scene) => {
      const keyframe = selectedTake(keyframes.get(scene.id));
      const expected = keyframe ? clipHash(clipBrief(scene, keyframe.url)) : null;
      return slot(scene.id, clips.get(scene.id) ?? [], expected);
    }),
    available: availability.pictures,
    videoAvailable: availability.video,
    imageCostUsd: IMAGE_COST_USD,
    videoCostPerSecondUsd: VIDEO_COST_PER_SECOND_USD,
    minClipSeconds: MIN_CLIP_SECONDS,
    minBilledSeconds: VIDEO_MIN_BILLED_SECONDS,
  };
}
