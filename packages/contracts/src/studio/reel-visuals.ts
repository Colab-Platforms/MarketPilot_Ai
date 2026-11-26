import { z } from 'zod';

// Pictures for a reel (docs/REEL_STUDIO.md section 3): a portrait per cast member and a
// keyframe per scene. Every attempt is kept as a take; the owner can switch between them.

export const reelTakeSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  createdAt: z.string(),
});
export type ReelTake = z.infer<typeof reelTakeSchema>;

export const reelVisualSchema = z.object({
  // The cast id ("c1") for a portrait, the scene id for a keyframe.
  subject: z.string(),
  current: reelTakeSchema.nullable(),
  // The current picture was drawn from details that have changed since.
  outdated: z.boolean(),
  // A new picture is being drawn.
  drawing: z.boolean(),
  // Why the last attempt failed, when it did and nothing newer succeeded.
  failure: z.string().nullable(),
  // Earlier pictures, newest first, the current one included.
  takes: z.array(reelTakeSchema),
});
export type ReelVisual = z.infer<typeof reelVisualSchema>;

export const reelVisualsSchema = z.object({
  portraits: z.array(reelVisualSchema),
  keyframes: z.array(reelVisualSchema),
  // One short video per scene, animated from its keyframe. `current.url` is a video.
  clips: z.array(reelVisualSchema),
  // Whether pictures can be drawn in this workspace (an image model and storage are set up).
  available: z.boolean(),
  // Whether clips can be rendered (a video model and storage are set up).
  videoAvailable: z.boolean(),
  // Rough cost of one picture in US dollars, for the estimate before drawing many.
  imageCostUsd: z.number(),
  // Rough cost of one second of video in US dollars on the main video model.
  videoCostPerSecondUsd: z.number(),
  // The shortest clip the video model renders; shorter scenes are rendered at this and trimmed.
  minClipSeconds: z.number(),
  // The provider bills every clip as at least this long, whatever is rendered.
  minBilledSeconds: z.number(),
});
export type ReelVisuals = z.infer<typeof reelVisualsSchema>;

export const REEL_VISUAL_KINDS = ['portraits', 'keyframes', 'clips'] as const;
export type ReelVisualKind = (typeof REEL_VISUAL_KINDS)[number];

// Drawing several at once: only those missing or outdated are drawn.
export const drawReelVisualsSchema = z.object({ kind: z.enum(REEL_VISUAL_KINDS) }).strict();
export type DrawReelVisuals = z.infer<typeof drawReelVisualsSchema>;
