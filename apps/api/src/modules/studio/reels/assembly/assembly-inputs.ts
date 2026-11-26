import type { ReelLanguage } from '@marketpilot/contracts';
import type { AssemblySpec } from '@/infra/media-assembly';
import { REEL_MUSIC_PROMPT_VERSION, REEL_VOICE_VERSION } from '@/modules/ai';
import { briefOf, ideaOf, sceneOf, type ProjectRow } from '../reel.mapper';
import { hashOf } from '../visuals/take-briefs';
import { clipTargets } from '../visuals/visual-targets';
import { selectedTake, takesBySubject } from '../visuals/visuals.mapper';

// Bump when caption styling changes, so earlier renders show as outdated.
export const CAPTION_STYLE_VERSION = 'captions@1';

// Which sound providers this server has; part of the hash, so adding one marks reels outdated.
export interface SoundAvailability {
  music: boolean;
  voice: boolean;
}

// What the scanner generates before assembling (ADR 0013). Null mood or line means none.
export interface RenderSound {
  reelId: string;
  musicMood: string | null;
  language: ReelLanguage;
  lengthSeconds: number;
  // One per scene, in scene order.
  voiceovers: (string | null)[];
}

export interface RenderInputs extends AssemblySpec {
  sound: RenderSound;
}

export type AssemblyInputs = { inputs: RenderInputs; hash: string } | { blockedBy: string };

// What the reel would be assembled from right now: every scene's selected clip, cut to the
// scene's length, with its on-screen text and voiceover, plus the idea's music mood. Only
// up-to-date clips count, so a render never shows a scene that no longer matches the storyboard.
export function assemblyInputs(row: ProjectRow, available: SoundAvailability): AssemblyInputs {
  const scenes = row.scenes.flatMap((s) => {
    const scene = sceneOf(s);
    return scene ? [scene] : [];
  });
  if (scenes.length === 0) return { blockedBy: 'Write the storyboard first' };

  const clips = takesBySubject(row, 'clip');
  const expected = new Map(
    clipTargets(row).flatMap((t) => ('hash' in t ? [[t.subject, t.hash] as const] : [])),
  );
  const spec: AssemblySpec = { scenes: [] };
  for (const scene of scenes) {
    const clip = selectedTake(clips.get(scene.id));
    if (!clip || clip.inputsHash !== expected.get(scene.id)) {
      return { blockedBy: 'Render an up-to-date clip for every scene first' };
    }
    spec.scenes.push({
      clipUrl: clip.url,
      durationSeconds: scene.durationSeconds,
      text: scene.onScreenText,
    });
  }

  const brief = briefOf(row);
  const chosen = row.ideas.find((i) => i.id === row.chosenIdeaId);
  const sound: RenderSound = {
    reelId: row.id,
    musicMood: available.music ? ((chosen && ideaOf(chosen)?.musicMood) ?? null) : null,
    language: brief.language,
    lengthSeconds: spec.scenes.reduce((sum, s) => sum + s.durationSeconds, 0),
    voiceovers: scenes.map((s) => (available.voice ? s.voiceover?.trim() || null : null)),
  };
  const version = [CAPTION_STYLE_VERSION, REEL_MUSIC_PROMPT_VERSION, REEL_VOICE_VERSION].join('+');
  const inputs: RenderInputs = { ...spec, sound };
  return { inputs, hash: hashOf(version, inputs) };
}
