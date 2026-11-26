import { z } from 'zod';
import { reelCharacterSchema, reelSceneSchema } from './reel-storyboard';
import { reelVisualsSchema } from './reel-visuals';

// Product reels (docs/REEL_STUDIO.md): a brief becomes reel ideas, the chosen idea becomes an
// editable storyboard, and later each scene becomes a keyframe and a clip.

export const REEL_GOALS = [
  {
    value: 'awareness',
    label: 'Get noticed',
    hint: 'Introduce the product to people who do not know it yet',
  },
  { value: 'offer', label: 'Drive sales', hint: 'Give people a reason to buy now' },
  { value: 'launch', label: 'Launch', hint: 'Announce something new' },
  { value: 'education', label: 'Teach', hint: 'Show how to use it or why it works' },
] as const;
export const reelGoalSchema = z.enum(['awareness', 'offer', 'launch', 'education']);
export type ReelGoal = z.infer<typeof reelGoalSchema>;

export const REEL_LENGTHS = [15, 30] as const;
export const reelLengthSchema = z.union([z.literal(15), z.literal(30)]);
export type ReelLength = z.infer<typeof reelLengthSchema>;

// The language of on-screen text and voiceover.
export const REEL_LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
] as const;
export const reelLanguageSchema = z.enum(['english', 'hindi', 'hinglish']);
export type ReelLanguage = z.infer<typeof reelLanguageSchema>;

export const REEL_AUDIENCE_MAX_CHARS = 300;
export const REEL_NOTES_MAX_CHARS = 1000;
// Each request for ideas returns this many; a reel may ask a few times.
export const IDEAS_PER_BATCH = 3;
export const MAX_IDEA_BATCHES = 3;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null));

export const createReelSchema = z
  .object({
    productId: z.string().uuid(),
    goal: reelGoalSchema,
    lengthSeconds: reelLengthSchema,
    language: reelLanguageSchema,
    // Empty means "use the audience from the brand profile".
    audience: optionalText(REEL_AUDIENCE_MAX_CHARS),
    notes: optionalText(REEL_NOTES_MAX_CHARS),
  })
  .strict();
export type CreateReelInput = z.input<typeof createReelSchema>;
export type CreateReel = z.output<typeof createReelSchema>;

export const reelIdeaSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  // What happens in the first two seconds to stop the scroll.
  hook: z.string(),
  format: z.string(),
  // The current trend the idea rides, and why it suits this brand. Null when it rides none.
  trend: z.object({ name: z.string(), why: z.string() }).nullable(),
  // Who appears on screen and where.
  persona: z.string(),
  story: z.string(),
  cta: z.string(),
  musicMood: z.string(),
  sceneCount: z.number().int(),
});
export type ReelIdea = z.infer<typeof reelIdeaSchema>;

// The finished video: the reel's clips joined, cut to length, with on-screen text burned in.
export const reelRenderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  url: z.string().url().nullable(),
  durationSeconds: z.number().nullable(),
  // Its entry in the library, once it is done.
  assetId: z.string().uuid().nullable(),
  // Clips, lengths or text have changed since it was assembled.
  outdated: z.boolean(),
  message: z.string().nullable(),
  createdAt: z.string(),
});
export type ReelRender = z.infer<typeof reelRenderSchema>;

export const reelAssemblySchema = z.object({
  // Whether this server can assemble reels.
  available: z.boolean(),
  // Why the reel cannot be assembled yet, in words for the owner. Null when it can.
  blockedBy: z.string().nullable(),
});
export type ReelAssembly = z.infer<typeof reelAssemblySchema>;

export const reelStatusSchema = z.enum([
  'ideating',
  'ideas_ready',
  'storyboarding',
  'storyboard_ready',
]);
export type ReelStatus = z.infer<typeof reelStatusSchema>;

export const reelProjectSchema = z.object({
  id: z.string().uuid(),
  status: reelStatusSchema,
  goal: reelGoalSchema,
  lengthSeconds: reelLengthSchema,
  language: reelLanguageSchema,
  audience: z.string().nullable(),
  notes: z.string().nullable(),
  productId: z.string().uuid().nullable(),
  productName: z.string(),
  // Newest batch last, in the order the model gave them.
  ideas: z.array(reelIdeaSchema),
  canAskForMoreIdeas: z.boolean(),
  chosenIdeaId: z.string().uuid().nullable(),
  cast: z.array(reelCharacterSchema),
  scenes: z.array(reelSceneSchema),
  visuals: reelVisualsSchema,
  // The latest assembly, or null if the reel was never assembled.
  render: reelRenderSchema.nullable(),
  assembly: reelAssemblySchema,
  // Why the last step did not finish, in words for the owner. Null when it did.
  message: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReelProject = z.infer<typeof reelProjectSchema>;

export const reelSummarySchema = z.object({
  id: z.string().uuid(),
  status: reelStatusSchema,
  // The chosen idea's title, or null before one is chosen.
  title: z.string().nullable(),
  productName: z.string(),
  sceneCount: z.number().int(),
  createdAt: z.string(),
});
export type ReelSummary = z.infer<typeof reelSummarySchema>;

export const reelListSchema = z.object({
  reels: z.array(reelSummarySchema),
  // Whether reel ideas can be made in this workspace (a model is set up).
  available: z.boolean(),
  // What a new brief starts from, from the brand profile.
  defaults: z.object({ language: reelLanguageSchema, audience: z.string().nullable() }),
});
export type ReelList = z.infer<typeof reelListSchema>;
