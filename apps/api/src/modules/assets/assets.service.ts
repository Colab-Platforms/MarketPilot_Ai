import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ASSET_PAGE_SIZE,
  ErrorCode,
  type Asset,
  type AssetKind,
  type AssetList,
  type AssetListQuery,
  type CreateAsset,
  type MediaUploadTicket,
  type WorkspaceRole,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { MediaStoragePort } from '@/infra/storage';
import { BrandProfileService } from '@/modules/brand';
import { decodeCursor, encodeCursor, toAsset } from './asset.mapper';

const MANAGE_ROLES: ReadonlySet<WorkspaceRole> = new Set(['owner', 'admin', 'manager', 'creator']);

// One folder per workspace, so a ticket for one tenant can never vouch for another's files.
export const libraryFolder = (workspaceId: string) => `marketpilot_library/${workspaceId}`;

export interface AssetActor {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface GeneratedReel {
  workspaceId: string;
  brandId: string;
  createdByUserId: string;
  renderId: string;
  url: string;
  name: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface GeneratedOutput {
  id: string;
  url: string;
  mediaType: string;
  width: number | null;
  height: number | null;
}

export interface GeneratedAssets {
  workspaceId: string;
  brandId: string;
  createdByUserId: string;
  outputs: GeneratedOutput[];
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStoragePort,
    private readonly profiles: BrandProfileService,
  ) {}

  async list(
    viewer: { workspaceId: string; userId: string },
    query: AssetListQuery,
  ): Promise<AssetList> {
    const { workspaceId, userId } = viewer;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (query.cursor && !cursor)
      throw new DomainError(ErrorCode.Validation, 'That page link is not valid', 400);

    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      ...(query.kind && { kind: query.kind }),
      ...(query.source && { source: query.source }),
      ...(cursor && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    };
    // One extra row tells whether another page exists.
    const rows = await this.prisma.withTenant(workspaceId, (tx) =>
      tx.asset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ASSET_PAGE_SIZE + 1,
        include: { feedback: { where: { userId } } },
      }),
    );
    const page = rows.slice(0, ASSET_PAGE_SIZE);
    const last = page.at(-1);
    return {
      assets: page.map(toAsset),
      nextCursor: rows.length > ASSET_PAGE_SIZE && last ? encodeCursor(last) : null,
      uploadAvailable: this.storage.isAvailable(),
    };
  }

  uploadTicket(actor: AssetActor, kind: AssetKind): MediaUploadTicket {
    this.assertCanManage(actor);
    if (!this.storage.isAvailable()) {
      throw new DomainError(ErrorCode.Internal, 'Uploading is not set up yet', 503);
    }
    return this.storage.createUploadTicket(libraryFolder(actor.workspaceId), kind);
  }

  // Saving the same file again returns its entry, and brings it back if it had been removed.
  async create(actor: AssetActor, input: CreateAsset): Promise<Asset> {
    this.assertCanManage(actor);
    const { workspaceId } = actor;
    if (!this.storage.ownsUrl(input.url, libraryFolder(workspaceId), input.kind)) {
      throw new DomainError(ErrorCode.Validation, 'Upload the file first, then save it', 400, {
        fields: { url: 'This is not a file uploaded to your library' },
      });
    }
    const row = await this.prisma.withTenant(workspaceId, async (tx) => {
      const brandId = await this.profiles.brandIdOf(tx, workspaceId);
      return tx.asset.upsert({
        where: { workspaceId_url: { workspaceId, url: input.url } },
        update: { deletedAt: null },
        create: {
          workspaceId,
          brandId,
          createdByUserId: actor.userId,
          kind: input.kind,
          source: 'upload',
          url: input.url,
          name: input.name || null,
          width: input.width,
          height: input.height,
          bytes: input.bytes,
          durationSeconds: input.durationSeconds,
        },
      });
    });
    return toAsset(row);
  }

  async remove(actor: AssetActor, id: string): Promise<void> {
    this.assertCanManage(actor);
    const { count } = await this.prisma.withTenant(actor.workspaceId, (tx) =>
      tx.asset.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } }),
    );
    if (count === 0) throw new DomainError(ErrorCode.NotFound, 'That file was not found', 404);
  }

  // An assembled reel joins the library as a generated video. Recording the same render twice
  // returns its existing entry. Called inside the transaction that finishes the render.
  async recordReel(tx: TenantTx, reel: GeneratedReel): Promise<string> {
    const asset = await tx.asset.upsert({
      where: { reelRenderId: reel.renderId },
      update: {},
      create: {
        workspaceId: reel.workspaceId,
        brandId: reel.brandId,
        createdByUserId: reel.createdByUserId,
        kind: 'video',
        source: 'generated',
        url: reel.url,
        mediaType: 'video/mp4',
        name: reel.name,
        width: reel.width,
        height: reel.height,
        durationSeconds: reel.durationSeconds,
        reelRenderId: reel.renderId,
      },
    });
    return asset.id;
  }

  // Called by the studio inside the transaction that stores its outputs.
  async recordGenerated(tx: TenantTx, generated: GeneratedAssets): Promise<void> {
    if (generated.outputs.length === 0) return;
    await tx.asset.createMany({
      data: generated.outputs.map((output) => ({
        workspaceId: generated.workspaceId,
        brandId: generated.brandId,
        createdByUserId: generated.createdByUserId,
        kind: 'image' as const,
        source: 'generated' as const,
        url: output.url,
        mediaType: output.mediaType,
        width: output.width,
        height: output.height,
        studioOutputId: output.id,
      })),
      skipDuplicates: true,
    });
  }

  private assertCanManage(actor: AssetActor): void {
    if (!MANAGE_ROLES.has(actor.role)) {
      throw new DomainError(
        ErrorCode.Forbidden,
        'Your role can view the library but not change it',
        403,
      );
    }
  }
}
