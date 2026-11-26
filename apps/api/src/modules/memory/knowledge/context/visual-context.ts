import { Injectable } from '@nestjs/common';
import { DEFAULT_IMAGE_DESIGN, imageDesignSchema, type ImageDesign } from '@marketpilot/contracts';
import { PrismaService } from '@/infra/prisma';
import { BrandProfileService } from '@/modules/brand';
import type { ContextFact } from './assemble';
import { confirmedFacts, confirmedList, confirmedText, fieldsOf } from './profile-facts';

// What shapes how an image looks. Tone of voice and words to avoid are left to text tasks.
const VISUAL_FACT_KEYS = [
  'category',
  'subcategory',
  'description',
  'city',
  'tagline',
  'personality',
  'visualAesthetics',
  'visualStyle',
  'contentThemes',
] as const;

const MAX_COLOURS = 4;
const isHttps = (url: string) => url.startsWith('https://');
const httpsOrNull = (url: string | null) => (url && isHttps(url) ? url : null);

function designOf(value: string | null): ImageDesign {
  const parsed = imageDesignSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_IMAGE_DESIGN;
}

export interface VisualProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
}

export interface VisualContext {
  brandName: string;
  facts: ContextFact[];
  colours: string[];
  // The owner's own recent posts (profile field "Your recent posts"), in stored order.
  recentPostUrls: string[];
  logoUrl: string | null;
  // "Post design style" from content preferences, or the product default when unset.
  designStyle: ImageDesign;
  product: VisualProduct | null;
}

// The Business Brain as an image task sees it: confirmed visual identity and, when one is
// chosen, the product with its real photos.
@Injectable()
export class VisualContextReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
  ) {}

  read(workspaceId: string, brandId: string, productId: string | null): Promise<VisualContext> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      const [profile, product] = await Promise.all([
        this.profiles.read(tx, workspaceId),
        productId
          ? tx.brandProduct.findFirst({ where: { id: productId, brandId, status: { not: 'rejected' } } })
          : Promise.resolve(null),
      ]);
      const fields = fieldsOf(profile);
      return {
        brandName: profile.brand.name,
        facts: confirmedFacts(fields, VISUAL_FACT_KEYS),
        colours: [...confirmedList(fields, 'primaryColors'), ...confirmedList(fields, 'secondaryColors')].slice(0, MAX_COLOURS),
        recentPostUrls: confirmedList(fields, 'recentPostImages').filter(isHttps),
        logoUrl: httpsOrNull(confirmedText(fields, 'logoUrl')),
        designStyle: designOf(confirmedText(fields, 'postDesignStyle')),
        product: product
          ? {
              id: product.id,
              name: product.name,
              description: product.description,
              imageUrls: product.imageUrls.filter(isHttps),
            }
          : null,
      };
    });
  }
}
