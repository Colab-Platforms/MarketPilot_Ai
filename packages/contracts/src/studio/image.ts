import { z } from 'zod';
import { assetFeedbackSchema } from '../assets/feedback';

// Formats the owner picks by where the post will go, not by pixel size.
export const IMAGE_FORMATS = [
  { value: 'square', label: 'Square', aspectRatio: '1:1', use: 'Feed post' },
  { value: 'portrait', label: 'Portrait', aspectRatio: '4:5', use: 'Instagram feed' },
  { value: 'story', label: 'Story', aspectRatio: '9:16', use: 'Story or reel cover' },
] as const;

export const imageFormatSchema = z.enum(['square', 'portrait', 'story']);
export type ImageFormat = z.infer<typeof imageFormatSchema>;

// How much design goes on top of the picture. The brand profile holds the default
// ("Post design style"); each image can override it.
export const IMAGE_DESIGNS = [
  { value: 'designed', label: 'Designed ad', hint: 'Headline, subheading, button, logo and themed details' },
  { value: 'minimal', label: 'Minimal text', hint: 'A clean picture with a headline and a small logo' },
  { value: 'photo', label: 'Photo first', hint: 'A clean picture with at most one line of text' },
] as const;

export const imageDesignSchema = z.enum(['designed', 'minimal', 'photo']);
export type ImageDesign = z.infer<typeof imageDesignSchema>;
export const DEFAULT_IMAGE_DESIGN: ImageDesign = 'designed';

export const MAX_IMAGE_VARIANTS = 4;
export const SUBHEADING_MAX_CHARS = 100;
export const BUTTON_TEXT_MAX_CHARS = 24;
export const BRIEF_MIN_CHARS = 10;
// Long enough for a whole post idea pasted from the copilot (hook, steps, caption).
export const BRIEF_MAX_CHARS = 3000;
export const HEADLINE_MAX_CHARS = 80;

// Text printed on the image exactly as written, in any language or script. Empty means none.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null));

export const createImageGenerationSchema = z
  .object({
    brief: z.string().trim().min(BRIEF_MIN_CHARS).max(BRIEF_MAX_CHARS),
    format: imageFormatSchema,
    productId: z.string().uuid().nullable().default(null),
    // Printed on the image exactly as written, in any language or script.
    headline: optionalText(HEADLINE_MAX_CHARS),
    variants: z.number().int().min(1).max(MAX_IMAGE_VARIANTS).default(2),
    // Null means "use the brand's default".
    design: imageDesignSchema.nullable().default(null),
    subheading: optionalText(SUBHEADING_MAX_CHARS),
    buttonText: optionalText(BUTTON_TEXT_MAX_CHARS),
    // Null means "on for designed and minimal posts, off for photo-first".
    showLogo: z.boolean().nullable().default(null),
  })
  .strict();
export type CreateImageGenerationInput = z.input<typeof createImageGenerationSchema>;
export type CreateImageGeneration = z.output<typeof createImageGenerationSchema>;

export const generationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const generatedImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  // Its library entry, which carries the rating and the style-reference star. Null if removed.
  assetId: z.string().uuid().nullable(),
  styleReference: z.boolean(),
  feedback: assetFeedbackSchema.nullable(),
});
export type GeneratedImage = z.infer<typeof generatedImageSchema>;

export const imageGenerationSchema = z.object({
  id: z.string().uuid(),
  status: generationStatusSchema,
  brief: z.string(),
  format: imageFormatSchema,
  productId: z.string().uuid().nullable(),
  productName: z.string().nullable(),
  headline: z.string().nullable(),
  subheading: z.string().nullable(),
  buttonText: z.string().nullable(),
  // As used for this image, after the brand default was applied.
  design: imageDesignSchema,
  showLogo: z.boolean(),
  variants: z.number().int(),
  images: z.array(generatedImageSchema),
  // Set when the job failed, or when it finished with fewer images than asked for.
  message: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type ImageGeneration = z.infer<typeof imageGenerationSchema>;

export const imageGenerationListSchema = z.object({
  generations: z.array(imageGenerationSchema),
  // Whether generating is switched on for this workspace (an image model and storage are set up).
  available: z.boolean(),
  // What a new image starts from: the brand's post design style, and whether a logo is on file.
  defaults: z.object({ design: imageDesignSchema, hasLogo: z.boolean() }),
});
export type ImageGenerationList = z.infer<typeof imageGenerationListSchema>;
