import { z } from 'zod';
import { assetFeedbackSchema } from './feedback';

export const assetKindSchema = z.enum(['image', 'video']);
export type AssetKind = z.infer<typeof assetKindSchema>;

// Where an asset came from: the owner uploaded it, or the studio generated it.
export const assetSourceSchema = z.enum(['upload', 'generated']);
export type AssetSource = z.infer<typeof assetSourceSchema>;

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
// The largest file media storage accepts in one request on its base plan.
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const ASSET_NAME_MAX_CHARS = 200;
export const ASSET_PAGE_SIZE = 40;

export const assetSchema = z.object({
  id: z.string().uuid(),
  kind: assetKindSchema,
  source: assetSourceSchema,
  url: z.string().url(),
  name: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  bytes: z.number().int().nullable(),
  durationSeconds: z.number().nullable(),
  createdAt: z.string(),
  // Starred by the owner: new images follow its look.
  styleReference: z.boolean(),
  // The viewer's own like or dislike; only generated images can be rated.
  feedback: assetFeedbackSchema.nullable(),
});
export type Asset = z.infer<typeof assetSchema>;

export const assetListQuerySchema = z
  .object({
    kind: assetKindSchema.optional(),
    source: assetSourceSchema.optional(),
    // Opaque: the `nextCursor` of the previous page.
    cursor: z.string().max(200).optional(),
  })
  .strict();
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;

export const assetListSchema = z.object({
  assets: z.array(assetSchema),
  nextCursor: z.string().nullable(),
  // Whether uploading is switched on for this workspace (media storage is set up).
  uploadAvailable: z.boolean(),
});
export type AssetList = z.infer<typeof assetListSchema>;

export const assetUploadTicketRequestSchema = z.object({ kind: assetKindSchema }).strict();
export type AssetUploadTicketRequest = z.infer<typeof assetUploadTicketRequestSchema>;

// Saves a file the browser has already uploaded with a ticket. The size and shape fields are
// copied from the storage response and are only used for display.
export const createAssetSchema = z
  .object({
    kind: assetKindSchema,
    url: z.string().url().max(2000),
    name: z.string().trim().max(ASSET_NAME_MAX_CHARS).nullable().default(null),
    width: z.number().int().positive().nullable().default(null),
    height: z.number().int().positive().nullable().default(null),
    bytes: z.number().int().nonnegative().nullable().default(null),
    durationSeconds: z.number().nonnegative().nullable().default(null),
  })
  .strict();
export type CreateAssetInput = z.input<typeof createAssetSchema>;
export type CreateAsset = z.output<typeof createAssetSchema>;
