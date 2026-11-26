import { z } from 'zod';
import {
  CHARACTER_AGE_MAX_CHARS,
  CHARACTER_LOOK_MAX_CHARS,
  CHARACTER_NAME_MAX_CHARS,
  CHARACTER_WARDROBE_MAX_CHARS,
  MAX_CAST,
  MAX_SCENES,
  MIN_SCENES,
  SCENE_ACTION_MAX_CHARS,
  SCENE_MAX_SECONDS,
  SCENE_MIN_SECONDS,
  SCENE_SETTING_MAX_CHARS,
  SCENE_TEXT_MAX_CHARS,
  SCENE_VOICEOVER_MAX_CHARS,
  reelCameraSchema,
  reelShotSchema,
} from '@marketpilot/contracts';

// JSON schemas sent to the model, strict and without unions (an empty string means "none"),
// and the Zod schemas that re-check what comes back. Limits the model may overrun are
// enforced by clipping in the normalisers, not by rejecting the whole answer.

const text = (description: string) => ({ type: 'string', description }) as const;
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const IDEA_PROPERTIES = {
  title: text('A short working title, at most 60 characters.'),
  hook: text(
    'What happens on screen in the first 2 seconds to stop the scroll, at most 160 characters.',
  ),
  format: text(
    'The reel format in a few words, e.g. "Problem to solution", "POV", "Before and after".',
  ),
  trendName: text('The current trend from the list this idea rides, or "" if none.'),
  trendWhy: text(
    'Why that trend suits this brand and product, or "" if none. At most 200 characters.',
  ),
  persona: text(
    'Who appears on screen: age, look, role and setting. Fictional people only. At most 300 characters.',
  ),
  story: text('The story beat by beat, at most 500 characters.'),
  cta: text('The closing call to action, at most 80 characters, in the reel language.'),
  musicMood: text('The mood of the background music in a few words. Never a named song.'),
  sceneCount: { type: 'integer', description: 'How many scenes, 3 to 8.' },
};

export const IDEAS_JSON_SCHEMA = object({
  ideas: { type: 'array', items: object(IDEA_PROPERTIES) },
});

const CHARACTER_PROPERTIES = {
  id: text('"c1", "c2" or "c3".'),
  name: text('A first name that fits the persona.'),
  ageRange: text('For example "about 30".'),
  look: text(
    'Face, hair, build and skin tone, specific enough to draw the same person every time. English.',
  ),
  wardrobe: text('What they wear in every scene. English.'),
};

const SCENE_PROPERTIES = {
  durationSeconds: {
    type: 'integer',
    description: `Seconds on screen, ${SCENE_MIN_SECONDS} to ${SCENE_MAX_SECONDS}.`,
  },
  shot: { type: 'string', enum: reelShotSchema.options },
  camera: { type: 'string', enum: reelCameraSchema.options },
  setting: text('Where it happens and the light, as one still photo would show it. English.'),
  action: text(
    'The one continuous action in this scene, beat by beat, filling its seconds. English.',
  ),
  characterIds: {
    type: 'array',
    items: { type: 'string' },
    description: 'Cast ids who appear, e.g. ["c1"].',
  },
  showsProduct: { type: 'boolean' },
  onScreenText: text('At most 6 words shown on screen, in the reel language, or "".'),
  voiceover: text('At most 20 spoken words, in the reel language, or "".'),
};

export const STORYBOARD_JSON_SCHEMA = object({
  cast: { type: 'array', items: object(CHARACTER_PROPERTIES) },
  scenes: { type: 'array', items: object(SCENE_PROPERTIES) },
});

export const SCENE_JSON_SCHEMA = object({ scene: object(SCENE_PROPERTIES) });

const str = z.string().catch('');

const ideaAnswer = z.object({
  title: str,
  hook: str,
  format: str,
  trendName: str,
  trendWhy: str,
  persona: str,
  story: str,
  cta: str,
  musicMood: str,
  sceneCount: z.number().catch(5),
});
export const ideasAnswerSchema = z.object({ ideas: z.array(ideaAnswer) });
export type IdeaAnswer = z.infer<typeof ideaAnswer>;

const characterAnswer = z.object({ id: str, name: str, ageRange: str, look: str, wardrobe: str });
export type CharacterAnswer = z.infer<typeof characterAnswer>;

const sceneAnswer = z.object({
  durationSeconds: z.number().catch(SCENE_MIN_SECONDS),
  shot: reelShotSchema.catch('medium'),
  camera: reelCameraSchema.catch('static'),
  setting: str,
  action: str,
  characterIds: z.array(z.string()).catch([]),
  showsProduct: z.boolean().catch(false),
  onScreenText: str,
  voiceover: str,
});
export type SceneAnswer = z.infer<typeof sceneAnswer>;

export const storyboardAnswerSchema = z.object({
  cast: z.array(characterAnswer),
  scenes: z.array(sceneAnswer),
});
export const sceneRewriteAnswerSchema = z.object({ scene: sceneAnswer });

export const LIMITS = {
  scenes: { min: MIN_SCENES, max: MAX_SCENES },
  cast: MAX_CAST,
  seconds: { min: SCENE_MIN_SECONDS, max: SCENE_MAX_SECONDS },
  setting: SCENE_SETTING_MAX_CHARS,
  action: SCENE_ACTION_MAX_CHARS,
  onScreenText: SCENE_TEXT_MAX_CHARS,
  voiceover: SCENE_VOICEOVER_MAX_CHARS,
  name: CHARACTER_NAME_MAX_CHARS,
  ageRange: CHARACTER_AGE_MAX_CHARS,
  look: CHARACTER_LOOK_MAX_CHARS,
  wardrobe: CHARACTER_WARDROBE_MAX_CHARS,
} as const;
