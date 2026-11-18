import { Injectable } from '@nestjs/common';
import type { KnowledgeExtraction } from '@prisma/client';
import {
  ErrorCode,
  profileFieldValueSchemas,
  type ReviewDecision,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { TenantTx } from '@/infra/prisma';
import { BrandProfileService, BrandService, type ApprovedEntry, type VerifiedField } from '@/modules/brand';
import {
  aiFieldPayloadSchema,
  productPayloadSchema,
  profilePayloadSchema,
  socialPayloadSchema,
} from './candidate-payload';

export interface ReviewContext {
  workspaceId: string;
  brandId: string;
  userId: string;
}

export interface ReviewResult {
  approved: number;
  rejected: number;
}

@Injectable()
export class ScanReviewService {
  constructor(
    private readonly brands: BrandService,
    private readonly profiles: BrandProfileService,
  ) {}

  // Approving is the only way a scanned candidate becomes a verified fact. Replaying
  // the same decisions is harmless: only rows still marked `candidate` are touched.
  async apply(tx: TenantTx, context: ReviewContext, decisions: ReviewDecision[]): Promise<ReviewResult> {
    const rows = await tx.knowledgeExtraction.findMany({
      where: { id: { in: decisions.map((d) => d.id) }, brandId: context.brandId, status: 'candidate' },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const fieldWrites: VerifiedField[] = [];
    const aiEntries: (ApprovedEntry & { rowId: string })[] = [];
    const errors: Record<string, string> = {};
    let approved = 0;
    let rejected = 0;

    for (const decision of decisions) {
      const row = byId.get(decision.id);
      if (!row) continue;
      if (decision.action === 'reject') {
        await this.mark(tx, row.id, 'rejected', context.userId);
        rejected += 1;
        continue;
      }
      if (row.kind === 'profile_field') {
        const payload = aiFieldPayloadSchema.parse(row.payload);
        const value = decision.value ?? payload.value;
        const edited = decision.value !== undefined && JSON.stringify(decision.value) !== JSON.stringify(payload.value);
        aiEntries.push({
          rowId: row.id,
          key: payload.key,
          value,
          // What the owner typed is theirs; otherwise record whether the site said it or the AI judged it.
          stamp: edited
            ? { sourceType: 'user_stated', sourceTrust: 1 }
            : {
                sourceType: payload.basis === 'stated' ? 'crawled' : 'ai_inferred',
                sourceUrl: payload.sourceUrl,
                sourceTrust: row.sourceTrust,
              },
        });
        await this.mark(tx, row.id, 'verified', context.userId);
        approved += 1;
        continue;
      }
      const field = await this.approve(tx, context, row, decision, errors);
      if (field) fieldWrites.push(field);
      if (!errors[row.id]) {
        await this.mark(tx, row.id, 'verified', context.userId);
        approved += 1;
      }
    }

    const applied = await this.profiles.applyApproved(tx, context, aiEntries);
    if (!applied.ok) {
      for (const entry of aiEntries) {
        const message = applied.errors[entry.key];
        if (message) errors[entry.rowId] = message;
      }
    }
    if (Object.keys(errors).length > 0) {
      throw new DomainError(ErrorCode.Validation, 'Check the highlighted details', 400, { fields: errors });
    }
    await this.brands.applyVerifiedFields(tx, context.workspaceId, context.brandId, fieldWrites);
    return { approved, rejected };
  }

  private async approve(
    tx: TenantTx,
    context: ReviewContext,
    row: KnowledgeExtraction,
    decision: ReviewDecision,
    errors: Record<string, string>,
  ): Promise<VerifiedField | null> {
    const common = {
      workspaceId: context.workspaceId,
      brandId: context.brandId,
      sourceType: 'crawled' as const,
      sourceTrust: row.sourceTrust,
      status: 'verified' as const,
      extractionId: row.id,
      extractedAt: row.createdAt,
      verifiedAt: new Date(),
      verifiedByUserId: context.userId,
    };

    if (row.kind === 'business_profile') {
      const payload = profilePayloadSchema.parse(row.payload);
      const edited = decision.value !== undefined && decision.value !== payload.value;
      const parsed = profileFieldValueSchemas[payload.field].safeParse(decision.value ?? payload.value);
      if (!parsed.success) {
        errors[row.id] = parsed.error.issues[0]?.message ?? 'Check this value';
        return null;
      }
      return {
        column: payload.field,
        value: parsed.data,
        sourceType: edited ? 'user_stated' : 'crawled',
        sourceUrl: payload.sourceUrl,
        sourceTrust: edited ? 1 : row.sourceTrust,
      };
    }

    if (row.kind === 'social_link') {
      const payload = socialPayloadSchema.parse(row.payload);
      const handle = payload.url.split('/').filter(Boolean).pop()?.replace(/^@/, '') ?? null;
      await tx.brandSocialAccount.upsert({
        where: {
          brandId_provider_profileUrl: { brandId: context.brandId, provider: payload.provider, profileUrl: payload.url },
        },
        create: { ...common, provider: payload.provider, profileUrl: payload.url, handle, sourceUrl: payload.sourceUrl },
        update: { status: 'verified', verifiedAt: new Date(), verifiedByUserId: context.userId },
      });
      return null;
    }

    if (row.kind === 'product') {
      const payload = productPayloadSchema.parse(row.payload);
      const data = {
        name: payload.name,
        description: payload.description,
        canonicalUrl: payload.url,
        category: payload.category,
        sku: payload.sku,
        priceMinor: payload.priceMinor,
        currency: payload.currency ?? 'INR',
        availability: payload.availability ?? 'unknown',
        imageUrls: payload.imageUrl ? [payload.imageUrl] : [],
        sourceUrl: payload.url ?? payload.sourceUrl,
      };
      const existing = payload.externalId
        ? await tx.brandProduct.findUnique({
            where: { brandId_externalId: { brandId: context.brandId, externalId: payload.externalId } },
          })
        : await tx.brandProduct.findFirst({
            where: { brandId: context.brandId, canonicalUrl: payload.url ?? undefined, name: payload.name },
          });
      if (existing) {
        await tx.brandProduct.update({
          where: { id: existing.id },
          data: { ...data, status: 'verified', verifiedAt: new Date(), verifiedByUserId: context.userId },
        });
      } else {
        await tx.brandProduct.create({ data: { ...common, ...data, externalId: payload.externalId } });
      }
    }
    return null;
  }

  private mark(tx: TenantTx, id: string, status: 'verified' | 'rejected', userId: string) {
    return tx.knowledgeExtraction.update({
      where: { id },
      data: { status, reviewedByUserId: userId, reviewedAt: new Date() },
    });
  }
}
