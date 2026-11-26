import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type Asset,
  type AssetFeedback,
  type UpdateAssetFeedback,
  type WorkspaceRole,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { toAsset, toFeedback } from './asset.mapper';
import type { AssetActor } from './assets.service';

const STAR_ROLES: ReadonlySet<WorkspaceRole> = new Set(['owner', 'admin', 'manager', 'creator']);
const STARRED_CONSIDERED = 10;
const LIKED_CONSIDERED = 20;

// A library image new images may follow, newest signal first.
export interface StyleCandidate {
  url: string;
  source: 'upload' | 'generated';
  // Set for generated images, so the studio can tell which design and product they had.
  studioOutputId: string | null;
}

export interface StyleCandidates {
  starred: StyleCandidate[];
  // Generated images someone liked and nobody disliked.
  liked: StyleCandidate[];
}

export interface OutputAssetState {
  assetId: string;
  styleReference: boolean;
  feedback: AssetFeedback | null;
}

// Likes, dislikes and style-reference stars on library images (ADR 0010).
@Injectable()
export class AssetFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  // Anyone in the workspace may rate a generated image; a null rating clears their feedback.
  async setFeedback(actor: AssetActor, assetId: string, input: UpdateAssetFeedback): Promise<Asset> {
    const { workspaceId, userId } = actor;
    const row = await this.prisma.withTenant(workspaceId, async (tx) => {
      const asset = await tx.asset.findFirst({ where: { id: assetId, deletedAt: null } });
      if (!asset) throw new DomainError(ErrorCode.NotFound, 'That image was not found', 404);
      if (asset.source !== 'generated') {
        throw new DomainError(ErrorCode.Validation, 'Only images made with AI can be rated', 400);
      }
      if (input.rating === null) {
        await tx.assetFeedback.deleteMany({ where: { assetId, userId } });
      } else {
        const reasons = input.rating === 'dislike' ? input.reasons : [];
        await tx.assetFeedback.upsert({
          where: { assetId_userId: { assetId, userId } },
          update: { rating: input.rating, reasons },
          create: { workspaceId, assetId, userId, rating: input.rating, reasons },
        });
      }
      return tx.asset.findUniqueOrThrow({ where: { id: assetId }, include: { feedback: { where: { userId } } } });
    });
    return toAsset(row);
  }

  // Starring keeps its first date, so the order of stars reflects when each was chosen.
  async setStyleReference(actor: AssetActor, assetId: string, on: boolean): Promise<Asset> {
    if (!STAR_ROLES.has(actor.role)) {
      throw new DomainError(ErrorCode.Forbidden, 'Your role cannot choose style references', 403);
    }
    const { workspaceId, userId } = actor;
    const row = await this.prisma.withTenant(workspaceId, async (tx) => {
      const asset = await tx.asset.findFirst({ where: { id: assetId, deletedAt: null } });
      if (!asset) throw new DomainError(ErrorCode.NotFound, 'That image was not found', 404);
      if (asset.kind !== 'image') {
        throw new DomainError(ErrorCode.Validation, 'Only images can be style references', 400);
      }
      return tx.asset.update({
        where: { id: assetId },
        data: { styleReferenceAt: on ? (asset.styleReferenceAt ?? new Date()) : null },
        include: { feedback: { where: { userId } } },
      });
    });
    return toAsset(row);
  }

  // For the studio, inside its own transaction.
  async styleCandidates(tx: TenantTx, brandId: string): Promise<StyleCandidates> {
    const base = { brandId, kind: 'image' as const, deletedAt: null };
    const pick = { url: true, source: true, studioOutputId: true } as const;
    const [starred, liked] = await Promise.all([
      tx.asset.findMany({
        where: { ...base, styleReferenceAt: { not: null } },
        orderBy: { styleReferenceAt: 'desc' },
        take: STARRED_CONSIDERED,
        select: pick,
      }),
      tx.asset.findMany({
        where: {
          ...base,
          source: 'generated',
          styleReferenceAt: null,
          feedback: { some: { rating: 'like' }, none: { rating: 'dislike' } },
        },
        orderBy: { createdAt: 'desc' },
        take: LIKED_CONSIDERED,
        select: pick,
      }),
    ]);
    return { starred, liked };
  }

  // The library side of each studio output: its asset, star and the viewer's rating.
  async forStudioOutputs(tx: TenantTx, outputIds: string[], userId: string): Promise<Map<string, OutputAssetState>> {
    if (outputIds.length === 0) return new Map();
    const rows = await tx.asset.findMany({
      where: { studioOutputId: { in: outputIds }, deletedAt: null },
      include: { feedback: { where: { userId } } },
    });
    return new Map(
      rows.flatMap((row) =>
        row.studioOutputId
          ? [
              [
                row.studioOutputId,
                { assetId: row.id, styleReference: row.styleReferenceAt !== null, feedback: toFeedback(row.feedback[0]) },
              ] as const,
            ]
          : [],
      ),
    );
  }
}
