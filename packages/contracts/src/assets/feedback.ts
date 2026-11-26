import { z } from 'zod';

export const feedbackRatingSchema = z.enum(['like', 'dislike']);
export type FeedbackRating = z.infer<typeof feedbackRatingSchema>;

// Quick reasons for a dislike, one tap each. Repeated reasons later become guidance for new images.
export const FEEDBACK_REASONS = [
  { value: 'text_wrong', label: 'Text is wrong' },
  { value: 'product_wrong', label: 'Product looks wrong' },
  { value: 'logo_wrong', label: 'Logo is wrong' },
  { value: 'too_busy', label: 'Too busy' },
  { value: 'too_plain', label: 'Too plain' },
  { value: 'not_my_style', label: 'Not my style' },
] as const;

export const feedbackReasonSchema = z.enum(['text_wrong', 'product_wrong', 'logo_wrong', 'too_busy', 'too_plain', 'not_my_style']);
export type FeedbackReason = z.infer<typeof feedbackReasonSchema>;

// The viewer's own feedback on one image.
export const assetFeedbackSchema = z.object({
  rating: feedbackRatingSchema,
  reasons: z.array(feedbackReasonSchema),
});
export type AssetFeedback = z.infer<typeof assetFeedbackSchema>;

// A null rating clears the viewer's feedback. Reasons only count with a dislike.
export const updateAssetFeedbackSchema = z
  .object({
    rating: feedbackRatingSchema.nullable(),
    reasons: z
      .array(feedbackReasonSchema)
      .max(FEEDBACK_REASONS.length)
      .default([])
      .transform((reasons) => [...new Set(reasons)]),
  })
  .strict();
export type UpdateAssetFeedbackInput = z.input<typeof updateAssetFeedbackSchema>;
export type UpdateAssetFeedback = z.output<typeof updateAssetFeedbackSchema>;

export const updateStyleReferenceSchema = z.object({ styleReference: z.boolean() }).strict();
export type UpdateStyleReference = z.infer<typeof updateStyleReferenceSchema>;
