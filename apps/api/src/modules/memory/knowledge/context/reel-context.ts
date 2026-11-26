import { Injectable } from '@nestjs/common';
import type { ReelLanguage } from '@marketpilot/contracts';
import { PrismaService } from '@/infra/prisma';
import { marketOf, type Market } from '@/modules/ai';
import { BrandProfileService } from '@/modules/brand';
import { ContextBuilder, price } from './context-builder';
import { confirmedFacts, confirmedList, confirmedText, fieldsOf } from './profile-facts';

// Enough for core facts and a few relevant passages; the product travels separately.
const REEL_CONTEXT_TOKENS = 1_200;

export interface ReelContextProduct {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  imageUrls: string[];
}

export interface ReelContext {
  brandName: string;
  // The business context block for reel tasks. Empty when no objective was given.
  contextText: string;
  product: ReelContextProduct | null;
  // Readable category for trend search, e.g. "Sweet shop, mithai". Null when not confirmed.
  category: string | null;
  market: Market;
  defaultLanguage: ReelLanguage;
  audience: string | null;
}

export interface ReelContextRequest {
  productId: string | null;
  // What the reel is for, used to pick relevant passages. Omit when only defaults are needed.
  objective?: string;
}

// The Business Brain as a reel task sees it: who the brand is (without the catalogue), the one
// product the reel is about, and where the brand sells, which decides whose trends apply.
@Injectable()
export class ReelContextReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
    private readonly contexts: ContextBuilder,
  ) {}

  async read(
    workspaceId: string,
    brandId: string,
    request: ReelContextRequest,
  ): Promise<ReelContext> {
    const [records, context] = await Promise.all([
      this.prisma.withTenant(workspaceId, async (tx) => {
        const [profile, product] = await Promise.all([
          this.profiles.read(tx, workspaceId),
          request.productId
            ? tx.brandProduct.findFirst({
                where: { id: request.productId, brandId, status: { not: 'rejected' } },
              })
            : Promise.resolve(null),
        ]);
        return { profile, product };
      }),
      request.objective
        ? this.contexts.build(workspaceId, brandId, {
            objective: request.objective,
            budgetTokens: REEL_CONTEXT_TOKENS,
            withCatalogue: false,
          })
        : Promise.resolve(null),
    ]);

    const fields = fieldsOf(records.profile);
    const { product } = records;
    const category = confirmedFacts(fields, ['category', 'subcategory'])
      .map((f) => f.value)
      .join(', ');
    return {
      brandName: records.profile.brand.name,
      contextText: context?.text ?? '',
      product: product
        ? {
            id: product.id,
            name: product.name,
            description: product.description,
            price: price(product.priceMinor, product.currency),
            imageUrls: product.imageUrls.filter((url) => url.startsWith('https://')),
          }
        : null,
      category: category || null,
      market: marketOf({
        city: confirmedText(fields, 'city'),
        country: confirmedText(fields, 'country'),
        serviceAreas: confirmedList(fields, 'serviceAreas'),
        audienceLocations: confirmedList(fields, 'audienceLocations'),
        salesChannels: confirmedList(fields, 'salesChannels'),
        operatingModel: confirmedText(fields, 'operatingModel'),
        onlineStoreUrl: confirmedText(fields, 'onlineStoreUrl'),
      }),
      defaultLanguage: confirmedText(fields, 'brand.language') === 'hi' ? 'hindi' : 'english',
      audience: confirmedText(fields, 'audienceSummary'),
    };
  }
}
