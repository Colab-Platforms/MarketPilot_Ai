import { createHash } from 'node:crypto';
import type { ReelCharacter, ReelSceneSpec } from '@marketpilot/contracts';
import {
  REEL_CLIP_PROMPT_VERSION,
  REEL_KEYFRAME_PROMPT_VERSION,
  REEL_PORTRAIT_PROMPT_VERSION,
  type ReelClipBrief,
  type ReelKeyframeBrief,
  type ReelPortraitBrief,
} from '@/modules/ai';

export interface ProductForPictures {
  name: string;
  imageUrls: string[];
}

export function portraitBrief(character: ReelCharacter): ReelPortraitBrief {
  return { ageRange: character.ageRange, look: character.look, wardrobe: character.wardrobe };
}

// Null when someone in the scene has no portrait yet: keyframes are drawn from portraits so
// the same person appears in every scene.
export function keyframeBrief(
  scene: ReelSceneSpec,
  cast: ReelCharacter[],
  portraitUrls: ReadonlyMap<string, string>,
  product: ProductForPictures,
): ReelKeyframeBrief | null {
  const people: ReelKeyframeBrief['people'] = [];
  for (const id of scene.characterIds) {
    const character = cast.find((c) => c.id === id);
    const portraitUrl = portraitUrls.get(id);
    if (!character) continue;
    if (!portraitUrl) return null;
    people.push({ look: character.look, wardrobe: character.wardrobe, portraitUrl });
  }
  return {
    shot: scene.shot,
    setting: scene.setting,
    action: scene.action,
    people,
    product: scene.showsProduct ? { name: product.name, imageUrls: product.imageUrls } : null,
  };
}

// Key order is fixed by sorting, so the same brief always hashes the same.
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

// A clip animates the scene's selected keyframe; a new keyframe or a new move outdates it.
export function clipBrief(scene: ReelSceneSpec, keyframeUrl: string): ReelClipBrief {
  return {
    keyframeUrl,
    camera: scene.camera,
    action: scene.action,
    durationSeconds: scene.durationSeconds,
  };
}

export function clipHash(brief: ReelClipBrief): string {
  return hashOf(REEL_CLIP_PROMPT_VERSION, brief);
}

export function portraitHash(brief: ReelPortraitBrief): string {
  return hashOf(REEL_PORTRAIT_PROMPT_VERSION, brief);
}

export function keyframeHash(brief: ReelKeyframeBrief): string {
  return hashOf(REEL_KEYFRAME_PROMPT_VERSION, brief);
}

export function hashOf(promptVersion: string, brief: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stable({ promptVersion, brief })))
    .digest('hex');
}
