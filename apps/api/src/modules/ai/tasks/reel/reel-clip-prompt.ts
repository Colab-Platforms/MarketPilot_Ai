import type { ReelCamera } from '@marketpilot/contracts';

export const REEL_CLIP_PROMPT_VERSION = 'reel.clip@2';
// Kling renders 3 to 15 seconds; a shorter scene is rendered at 3 and trimmed at assembly.
export const MIN_CLIP_SECONDS = 3;

// What shapes a clip, nothing else, so its hash says when a clip is outdated. On-screen text
// and voiceover are added at assembly and are left out on purpose.
export interface ReelClipBrief {
  keyframeUrl: string;
  camera: ReelCamera;
  action: string;
  durationSeconds: number;
}

const CAMERA: Record<ReelCamera, string> = {
  static: 'Locked-off camera; all the movement comes from the subject.',
  push_in: 'The camera pushes in steadily toward the subject.',
  pull_out: 'The camera pulls back steadily to reveal more of the scene.',
  pan: 'The camera pans smoothly to follow the action.',
  tracking: 'The camera tracks alongside the subject as they move.',
  handheld: 'Natural handheld movement, like a creator filming on a phone.',
};

export const clipSeconds = (brief: ReelClipBrief) =>
  Math.max(MIN_CLIP_SECONDS, Math.ceil(brief.durationSeconds));

// Short and concrete: video models follow the first frame for looks, and the prompt only for motion.
export function composeClipPrompt(brief: ReelClipBrief): string {
  return [
    `${brief.action.replace(/\s+/g, ' ').trim()}`,
    CAMERA[brief.camera],
    'Lively, natural motion that continues for the whole clip: people move, breathe and react, never a still image.',
    'Keep every person, face, outfit and the product exactly as in the first frame.',
    'The product stays one single item with its label readable. No new people, no text, no captions.',
  ].join(' ');
}
