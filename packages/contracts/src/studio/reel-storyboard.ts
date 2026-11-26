import { z } from 'zod';

// Reel storyboards (docs/REEL_STUDIO.md). Every scene becomes one keyframe image and one short
// clip, so each field describes something a single still picture and a few seconds of simple
// motion can show.

export const REEL_SHOTS = [
  { value: 'close_up', label: 'Close-up' },
  { value: 'medium', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
  { value: 'detail', label: 'Product detail' },
] as const;
export const reelShotSchema = z.enum(['close_up', 'medium', 'wide', 'detail']);
export type ReelShot = z.infer<typeof reelShotSchema>;

export const REEL_CAMERAS = [
  { value: 'static', label: 'Still camera' },
  { value: 'push_in', label: 'Slow push in' },
  { value: 'pull_out', label: 'Slow pull out' },
  { value: 'pan', label: 'Pan' },
  { value: 'tracking', label: 'Follow the subject' },
  { value: 'handheld', label: 'Handheld' },
] as const;
export const reelCameraSchema = z.enum([
  'static',
  'push_in',
  'pull_out',
  'pan',
  'tracking',
  'handheld',
]);
export type ReelCamera = z.infer<typeof reelCameraSchema>;

// Clip lengths the video model renders well; one scene is one clip.
export const SCENE_MIN_SECONDS = 2;
export const SCENE_MAX_SECONDS = 8;
export const MIN_SCENES = 2;
export const MAX_SCENES = 10;
export const MAX_CAST = 3;

export const SCENE_SETTING_MAX_CHARS = 300;
export const SCENE_ACTION_MAX_CHARS = 400;
export const SCENE_TEXT_MAX_CHARS = 80;
export const SCENE_VOICEOVER_MAX_CHARS = 200;
export const CHARACTER_NAME_MAX_CHARS = 40;
export const CHARACTER_AGE_MAX_CHARS = 20;
export const CHARACTER_LOOK_MAX_CHARS = 300;
export const CHARACTER_WARDROBE_MAX_CHARS = 200;
export const REWRITE_INSTRUCTION_MIN_CHARS = 3;
export const REWRITE_INSTRUCTION_MAX_CHARS = 300;

// Cast ids are short and stable ("c1"), so scenes refer to people without repeating them.
export const characterIdSchema = z.string().regex(/^c[1-9]$/);

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

export const reelCharacterSchema = z.object({
  id: characterIdSchema,
  name: z.string().trim().min(1).max(CHARACTER_NAME_MAX_CHARS),
  ageRange: z.string().trim().min(1).max(CHARACTER_AGE_MAX_CHARS),
  look: z.string().trim().min(1).max(CHARACTER_LOOK_MAX_CHARS),
  wardrobe: z.string().trim().min(1).max(CHARACTER_WARDROBE_MAX_CHARS),
});
export type ReelCharacter = z.infer<typeof reelCharacterSchema>;

// What the owner can change on a scene. Text edits are free; nothing is rendered in this phase.
export const reelSceneSpecSchema = z.object({
  durationSeconds: z.number().int().min(SCENE_MIN_SECONDS).max(SCENE_MAX_SECONDS),
  shot: reelShotSchema,
  camera: reelCameraSchema,
  setting: z.string().trim().min(1).max(SCENE_SETTING_MAX_CHARS),
  action: z.string().trim().min(1).max(SCENE_ACTION_MAX_CHARS),
  characterIds: z.array(characterIdSchema).max(MAX_CAST),
  showsProduct: z.boolean(),
  // Shown on screen at assembly, in the reel's language. Null means no text on this scene.
  onScreenText: nullableText(SCENE_TEXT_MAX_CHARS),
  // Spoken over the scene at assembly when voiceover is set up (ADR 0013).
  voiceover: nullableText(SCENE_VOICEOVER_MAX_CHARS),
});
export type ReelSceneSpec = z.infer<typeof reelSceneSpecSchema>;

export const reelSceneSchema = reelSceneSpecSchema.extend({
  id: z.string().uuid(),
  position: z.number().int(),
});
export type ReelScene = z.infer<typeof reelSceneSchema>;

export const updateReelSceneSchema = reelSceneSpecSchema.partial().strict();
export type UpdateReelScene = z.infer<typeof updateReelSceneSchema>;

// A new scene goes after `afterSceneId`, or first when it is null.
export const addReelSceneSchema = z.object({ afterSceneId: z.string().uuid().nullable() }).strict();
export type AddReelScene = z.infer<typeof addReelSceneSchema>;

export const reorderReelScenesSchema = z
  .object({ sceneIds: z.array(z.string().uuid()).min(1).max(MAX_SCENES) })
  .strict();
export type ReorderReelScenes = z.infer<typeof reorderReelScenesSchema>;

export const updateReelCharacterSchema = reelCharacterSchema.omit({ id: true }).partial().strict();
export type UpdateReelCharacter = z.infer<typeof updateReelCharacterSchema>;

export const rewriteReelSceneSchema = z
  .object({
    instruction: z
      .string()
      .trim()
      .min(REWRITE_INSTRUCTION_MIN_CHARS)
      .max(REWRITE_INSTRUCTION_MAX_CHARS),
  })
  .strict();
export type RewriteReelScene = z.infer<typeof rewriteReelSceneSchema>;
