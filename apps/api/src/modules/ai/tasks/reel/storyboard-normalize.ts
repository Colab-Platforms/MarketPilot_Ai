import type { ReelCharacter, ReelIdea, ReelSceneSpec } from '@marketpilot/contracts';
import { LIMITS, type CharacterAnswer, type IdeaAnswer, type SceneAnswer } from './reel-output';

export type ReelIdeaDraft = Omit<ReelIdea, 'id'>;

export interface ReelStoryboardDraft {
  cast: ReelCharacter[];
  scenes: ReelSceneSpec[];
}

const MIN_IDEA_SCENES = 3;
const MAX_IDEA_SCENES = 8;

export function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() : flat;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(value), min), max);

export function normalizeIdea(answer: IdeaAnswer): ReelIdeaDraft | null {
  const title = clip(answer.title, 60);
  const hook = clip(answer.hook, 160);
  const story = clip(answer.story, 500);
  if (!title || !hook || !story) return null;
  const trendName = clip(answer.trendName, 60);
  return {
    title,
    hook,
    format: clip(answer.format, 40) || 'Product story',
    trend: trendName ? { name: trendName, why: clip(answer.trendWhy, 200) } : null,
    persona: clip(answer.persona, 300),
    story,
    cta: clip(answer.cta, 80),
    musicMood: clip(answer.musicMood, 60),
    sceneCount: clamp(answer.sceneCount, MIN_IDEA_SCENES, MAX_IDEA_SCENES),
  };
}

// Makes scene lengths add up to the reel length, one second at a time, keeping every scene
// inside the range a clip can be rendered at. Too few scenes for the length stay as close as
// the range allows.
export function fitDurations(durations: number[], target: number): number[] {
  const { min, max } = LIMITS.seconds;
  const fitted = durations.map((d) => clamp(d, min, max));
  let gap = target - fitted.reduce((sum, d) => sum + d, 0);
  while (gap !== 0) {
    const step = gap > 0 ? 1 : -1;
    // Grow the shortest scene, or shrink the longest, so the rhythm stays even.
    const candidates = fitted
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => (step > 0 ? d < max : d > min))
      .sort((a, b) => (step > 0 ? a.d - b.d : b.d - a.d));
    const pick = candidates[0];
    if (!pick) break;
    fitted[pick.i] = pick.d + step;
    gap -= step;
  }
  return fitted;
}

// Keeps the first usable characters, renumbered c1, c2, ... `ids` maps what the model called
// each one to its new id.
export function normalizeCast(answers: CharacterAnswer[]): {
  cast: ReelCharacter[];
  ids: Map<string, string>;
} {
  const cast: ReelCharacter[] = [];
  const ids = new Map<string, string>();
  for (const answer of answers) {
    if (cast.length >= LIMITS.cast) break;
    const name = clip(answer.name, LIMITS.name);
    const look = clip(answer.look, LIMITS.look);
    if (!name || !look) continue;
    const id = `c${cast.length + 1}`;
    ids.set(answer.id.trim(), id);
    cast.push({
      id,
      name,
      ageRange: clip(answer.ageRange, LIMITS.ageRange) || 'adult',
      look,
      wardrobe: clip(answer.wardrobe, LIMITS.wardrobe) || 'Everyday clothes',
    });
  }
  return { cast, ids };
}

export function normalizeScene(
  answer: SceneAnswer,
  ids: ReadonlyMap<string, string>,
): ReelSceneSpec | null {
  const setting = clip(answer.setting, LIMITS.setting);
  const action = clip(answer.action, LIMITS.action);
  if (!setting || !action) return null;
  const characterIds = [...new Set(answer.characterIds.flatMap((id) => ids.get(id.trim()) ?? []))];
  return {
    durationSeconds: clamp(answer.durationSeconds, LIMITS.seconds.min, LIMITS.seconds.max),
    shot: answer.shot,
    camera: answer.camera,
    setting,
    action,
    characterIds,
    showsProduct: answer.showsProduct,
    onScreenText: clip(answer.onScreenText, LIMITS.onScreenText) || null,
    voiceover: clip(answer.voiceover, LIMITS.voiceover) || null,
  };
}

// Null when the answer has too few usable scenes to make a reel.
export function normalizeStoryboard(
  answer: { cast: CharacterAnswer[]; scenes: SceneAnswer[] },
  lengthSeconds: number,
): ReelStoryboardDraft | null {
  const { cast, ids } = normalizeCast(answer.cast);
  const scenes = answer.scenes
    .map((s) => normalizeScene(s, ids))
    .filter((s): s is ReelSceneSpec => s !== null)
    .slice(0, LIMITS.scenes.max);
  if (scenes.length < LIMITS.scenes.min) return null;
  const durations = fitDurations(
    scenes.map((s) => s.durationSeconds),
    lengthSeconds,
  );
  return {
    cast,
    scenes: scenes.map((s, i) => ({ ...s, durationSeconds: durations[i] ?? s.durationSeconds })),
  };
}
