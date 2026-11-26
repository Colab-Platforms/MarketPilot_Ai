import { IMAGE_FORMATS, type CreateImageGeneration, type ImageDesign, type ImageFormat } from '@marketpilot/contracts';
import type { ImageAspectRatio, ImageBrief } from '@/modules/ai';
import type { VisualContext } from '@/modules/memory';

const FORMATS = new Map(IMAGE_FORMATS.map((f) => [f.value, f]));

function formatOf(format: ImageFormat): { aspectRatio: ImageAspectRatio; placement: string } {
  const found = FORMATS.get(format) ?? IMAGE_FORMATS[0];
  return { aspectRatio: found.aspectRatio, placement: `a ${found.use.toLowerCase()}` };
}

// The owner's choices for this image, with the brand's defaults filled in. This is what is
// stored with the job, so history shows how each image was really made.
// A type alias, not an interface, so Prisma accepts it as a JSON value.
export type ResolvedImageInput = CreateImageGeneration & { design: ImageDesign; showLogo: boolean };

export function resolveInput(input: CreateImageGeneration, context: VisualContext): ResolvedImageInput {
  const design = input.design ?? context.designStyle;
  const wantsLogo = input.showLogo ?? design !== 'photo';
  return { ...input, design, showLogo: wantsLogo && context.logoUrl !== null };
}

// The owner's request plus what the Business Brain knows, in the shape the image task takes.
// `styleImageUrls` are the images picked for this request to follow (pickStyleReferences).
export function toImageBrief(input: ResolvedImageInput, context: VisualContext, styleImageUrls: string[]): ImageBrief {
  return {
    request: input.brief,
    ...formatOf(input.format),
    design: input.design,
    text: { headline: input.headline, subheading: input.subheading, buttonText: input.buttonText },
    logoUrl: input.showLogo ? context.logoUrl : null,
    brand: { name: context.brandName, facts: context.facts, colours: context.colours },
    product: context.product,
    styleImageUrls,
  };
}
