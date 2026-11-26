import type { StudioGeneration, StudioOutput } from '@prisma/client';
import { createImageGenerationSchema, type CreateImageGeneration, type ImageGeneration } from '@marketpilot/contracts';
import type { OutputAssetState } from '@/modules/assets';

export type GenerationRow = StudioGeneration & { outputs: StudioOutput[] };

const FALLBACK_INPUT: CreateImageGeneration = {
  brief: '',
  format: 'square',
  productId: null,
  headline: null,
  subheading: null,
  buttonText: null,
  design: null,
  showLogo: null,
  variants: 1,
};

// `assets` maps each output to its library entry; missing means it was removed from the library.
export function toImageGeneration(row: GenerationRow, assets: ReadonlyMap<string, OutputAssetState> = new Map()): ImageGeneration {
  // Input was validated and resolved on the way in. Rows from before design styles existed
  // were photo-first with no logo, which is how they are shown.
  const parsed = createImageGenerationSchema.safeParse(row.input);
  const input = parsed.success ? parsed.data : FALLBACK_INPUT;
  return {
    id: row.id,
    status: row.status,
    brief: input.brief,
    format: input.format,
    productId: row.productId,
    productName: row.productName,
    headline: input.headline,
    subheading: input.subheading,
    buttonText: input.buttonText,
    design: input.design ?? 'photo',
    showLogo: input.showLogo ?? false,
    variants: row.requested,
    images: [...row.outputs]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((o) => {
        const asset = assets.get(o.id);
        return {
          id: o.id,
          url: o.url,
          width: o.width,
          height: o.height,
          assetId: asset?.assetId ?? null,
          styleReference: asset?.styleReference ?? false,
          feedback: asset?.feedback ?? null,
        };
      }),
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
