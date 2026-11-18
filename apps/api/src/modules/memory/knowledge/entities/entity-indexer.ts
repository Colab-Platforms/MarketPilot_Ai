import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma';
import { BrandProfileService } from '@/modules/brand';
import {
  audienceDocument,
  competitorDocument,
  faqDocument,
  policyDocument,
  productDocument,
  profileDocuments,
  serviceDocument,
  type EntityDocument,
} from './entity-documents';
import { planEntitySync, type ExistingEntityChunk } from './sync-plan';

// Approved records and profile facts have no web page behind them, so they hang off one
// manual source per brand.
const MANUAL_SOURCE_URI = 'brand://profile-and-catalogue';

export interface EntitySyncResult {
  created: number;
  superseded: number;
  removed: number;
}

// Keeps the search index in step with the owner-approved structured memory. Safe to run
// as often as needed: unchanged records produce no work.
@Injectable()
export class EntityIndexer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
  ) {}

  sync(workspaceId: string, brandId: string): Promise<EntitySyncResult> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      const where = { brandId, status: 'verified' as const };
      const [profile, products, services, policies, faqs, audiences, competitors] = await Promise.all([
        this.profiles.read(tx, workspaceId),
        tx.brandProduct.findMany({ where }),
        tx.brandService.findMany({ where }),
        tx.brandPolicy.findMany({ where }),
        tx.brandFaq.findMany({ where }),
        tx.brandAudience.findMany({ where }),
        tx.brandCompetitor.findMany({ where }),
      ]);
      const documents: EntityDocument[] = [
        ...profileDocuments(profile),
        ...products.map(productDocument),
        ...services.map(serviceDocument),
        ...policies.map(policyDocument),
        ...faqs.map(faqDocument),
        ...audiences.map(audienceDocument),
        ...competitors.map(competitorDocument),
      ];

      const rows = await tx.knowledgeChunk.findMany({
        where: { brandId, entityType: { not: null }, entityId: { not: null } },
        select: { id: true, entityType: true, entityId: true, state: true, version: true, metadata: true },
      });
      const existing: ExistingEntityChunk[] = rows.map((row) => ({
        id: row.id,
        entityType: row.entityType as string,
        entityId: row.entityId as string,
        state: row.state,
        version: row.version,
        entityHash: (row.metadata as { entityHash?: string } | null)?.entityHash ?? null,
      }));

      const plan = planEntitySync(existing, documents);
      if (plan.supersedeChunkIds.length > 0) {
        await tx.knowledgeChunk.updateMany({ where: { id: { in: plan.supersedeChunkIds } }, data: { state: 'superseded' } });
      }
      if (plan.deleteChunkIds.length > 0) {
        await tx.knowledgeChunk.updateMany({ where: { id: { in: plan.deleteChunkIds } }, data: { state: 'deleted' } });
      }
      if (plan.create.length > 0) {
        const source = await tx.knowledgeSource.upsert({
          where: { brandId_kind_uri: { brandId, kind: 'manual', uri: MANUAL_SOURCE_URI } },
          create: { workspaceId, brandId, kind: 'manual', uri: MANUAL_SOURCE_URI, label: 'Brand profile and catalogue' },
          update: {},
        });
        await tx.knowledgeChunk.createMany({
          data: plan.create.map((chunk) => ({
            workspaceId,
            brandId,
            sourceId: source.id,
            entityType: chunk.entityType,
            entityId: chunk.entityId,
            ordinal: chunk.ordinal,
            content: chunk.content,
            contentHash: chunk.contentHash,
            tokenCount: chunk.tokenCount,
            version: chunk.version,
            metadata: { entityHash: chunk.entityHash, title: chunk.title },
          })),
          skipDuplicates: true,
        });
      }

      // A vector for text that is no longer live must not linger; it can always be rebuilt.
      await tx.knowledgeEmbedding.deleteMany({
        where: { brandId, chunk: { entityType: { not: null }, state: { not: 'active' } } },
      });

      return { created: plan.create.length, superseded: plan.supersedeChunkIds.length, removed: plan.deleteChunkIds.length };
    });
  }
}
