import { Injectable } from '@nestjs/common';
import type { BrandProduct, BrandService } from '@prisma/client';
import type { ProfileResponse } from '@marketpilot/contracts';
import { PrismaService } from '@/infra/prisma';
import { BrandProfileService } from '@/modules/brand';
import { Retriever } from '../retrieval/retriever';
import { assembleContext, type AssembledContext, type ContextFact, type Offering } from './assemble';
import { confirmedFacts, fieldsOf } from './profile-facts';

const DEFAULT_BUDGET_TOKENS = 2_500;
const MIN_BUDGET_TOKENS = 600;
const MAX_BUDGET_TOKENS = 12_000;
const PASSAGES_TO_CONSIDER = 10;
const MAX_OFFERINGS = 200;

// The facts every task needs whatever is asked: who the brand is, who it serves, how it
// speaks and what it must never say. Everything else arrives through retrieval when relevant.
const CORE_FACT_KEYS = [
  'brand.name',
  'category',
  'subcategory',
  'description',
  'city',
  'tagline',
  'positioning',
  'usp',
  'audienceSummary',
  'idealCustomer',
  'toneOfVoice',
  'communicationStyle',
  'personality',
  'wordsToUse',
  'wordsToAvoid',
  'topicsToAvoid',
  'brand.language',
  'primaryObjective',
  'preferredChannels',
  'captionLength',
  'preferredHashtags',
] as const;


export interface ContextRequest {
  // What the context is for, in plain words: the owner's question or the task's goal.
  objective: string;
  budgetTokens?: number;
  // A task about one known product leaves the catalogue out and spends the budget on passages.
  withCatalogue?: boolean;
}

export interface BrandContext extends AssembledContext {
  brandId: string;
  retrievalMode: 'hybrid' | 'keyword';
}

function coreFacts(profile: ProfileResponse): ContextFact[] {
  return confirmedFacts(fieldsOf(profile), CORE_FACT_KEYS);
}

export function price(minor: number | null, currency: string): string | null {
  if (minor === null) return null;
  const amount = (minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return currency === 'INR' ? `₹${amount}` : `${currency} ${amount}`;
}

const featured = (attributes: unknown) =>
  !!attributes && typeof attributes === 'object' && (attributes as { featured?: unknown }).featured === true;

const AVAILABILITY: Record<BrandProduct['availability'], string | null> = {
  in_stock: 'in stock',
  out_of_stock: 'out of stock',
  preorder: 'pre-order',
  unknown: null,
};

function productOffering(row: BrandProduct): Offering {
  return {
    kind: 'product',
    id: row.id,
    name: row.name,
    featured: featured(row.attributes),
    price: price(row.priceMinor, row.currency),
    details: [AVAILABILITY[row.availability], row.category].filter((d): d is string => !!d),
    description: row.description,
  };
}

function serviceOffering(row: BrandService): Offering {
  return {
    kind: 'service',
    id: row.id,
    name: row.name,
    featured: featured(row.attributes),
    price: price(row.priceMinor, row.currency),
    details: row.durationMinutes ? [`${row.durationMinutes} min`] : [],
    description: row.description,
  };
}

// Builds the business context for one AI task: confirmed core facts, the live catalogue
// and the passages most relevant to the objective, within a token budget.
@Injectable()
export class ContextBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
    private readonly retriever: Retriever,
  ) {}

  async build(workspaceId: string, brandId: string, request: ContextRequest): Promise<BrandContext> {
    const budget = Math.min(Math.max(request.budgetTokens ?? DEFAULT_BUDGET_TOKENS, MIN_BUDGET_TOKENS), MAX_BUDGET_TOKENS);

    const [records, retrieval] = await Promise.all([
      this.prisma.withTenant(workspaceId, async (tx) => {
        const where = { brandId, status: 'verified' as const };
        const [profile, products, services] = await Promise.all([
          this.profiles.read(tx, workspaceId),
          tx.brandProduct.findMany({ where, take: MAX_OFFERINGS }),
          tx.brandService.findMany({ where, take: MAX_OFFERINGS }),
        ]);
        return { profile, products, services };
      }),
      this.retriever.retrieve(workspaceId, brandId, request.objective, { limit: PASSAGES_TO_CONSIDER }),
    ]);

    const assembled = assembleContext(
      {
        brandName: records.profile.brand.name,
        facts: coreFacts(records.profile),
        offerings:
          request.withCatalogue === false
            ? []
            : [...records.products.map(productOffering), ...records.services.map(serviceOffering)],
        passages: retrieval.passages,
      },
      budget,
    );
    return { ...assembled, brandId, retrievalMode: retrieval.mode };
  }
}
