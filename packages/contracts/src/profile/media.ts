import { z } from 'zod';

export const MAX_PRODUCT_IMAGES = 6;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// What an upload is for; each purpose has its own storage folder per workspace.
export const mediaPurposeSchema = z.enum(['product_image', 'brand_logo', 'reference_post']);
export type MediaPurpose = z.infer<typeof mediaPurposeSchema>;

export const uploadTicketRequestSchema = z.object({ purpose: mediaPurposeSchema }).strict();
export type UploadTicketRequest = z.infer<typeof uploadTicketRequestSchema>;

// Permission for the browser to upload one file straight to object storage. The browser posts
// `fields` plus the file (as `file`) to `uploadUrl`, then reads the stored file's public URL
// from the JSON response at `urlField`. Nothing provider-specific leaks beyond this shape.
export const mediaUploadTicketSchema = z.object({
  uploadUrl: z.string().url(),
  fields: z.record(z.string()),
  urlField: z.string(),
  expiresAt: z.string(),
});
export type MediaUploadTicket = z.infer<typeof mediaUploadTicketSchema>;
