import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type CreateImageGeneration,
  type ImageGeneration,
  type ImageGenerationList,
  type WorkspaceRole,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { Env } from '@/config';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { MediaStoragePort } from '@/infra/storage';
import { AiService } from '@/modules/ai';
import { AssetFeedbackService, type OutputAssetState } from '@/modules/assets';
import { BrandProfileService } from '@/modules/brand';
import type { AuthPrincipal } from '@/modules/identity';
import { MemoryService } from '@/modules/memory';
import { resolveInput, toImageBrief } from './image-brief';
import { toImageGeneration, type GenerationRow } from './image-generation.mapper';
import { ImageJobRunner } from './image-job.runner';
import { StyleReferenceReader } from './style-reference.reader';

export const GENERATE_ROLES: readonly WorkspaceRole[] = ['owner', 'admin', 'manager', 'creator'];
const CAN_GENERATE: ReadonlySet<WorkspaceRole> = new Set(GENERATE_ROLES);

export interface GenerationActor {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}
const MAX_ACTIVE_PER_WORKSPACE = 2;
const LIST_LIMIT = 30;
const DAY_MS = 24 * 60 * 60_000;
// Jobs run in this process. One still open after this was lost to a restart; with three
// models at two minutes each, a healthy job always finishes well inside it.
const STALE_AFTER_MS = 10 * 60_000;
const LOST_MESSAGE = 'This request was interrupted. Try again.';
const ACTIVE = ['queued', 'running'] as const;
// Any range wider than the prompt's layout list works; the prompt takes it modulo its length.
const LAYOUT_SEEDS = 1000;

@Injectable()
export class ImageGenerationService {
  private readonly dailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: MediaStoragePort,
    private readonly profiles: BrandProfileService,
    private readonly memory: MemoryService,
    private readonly runner: ImageJobRunner,
    private readonly references: StyleReferenceReader,
    private readonly feedback: AssetFeedbackService,
    config: ConfigService<Env, true>,
  ) {
    this.dailyLimit = config.get('STUDIO_DAILY_IMAGE_LIMIT', { infer: true });
  }

  get available(): boolean {
    return this.ai.imagesAvailable && this.storage.isAvailable();
  }

  // Called from the Create page and from the copilot; both pass who asked and a key for this request.
  async create(actor: GenerationActor, input: CreateImageGeneration, idempotencyKey: string): Promise<ImageGeneration> {
    if (!CAN_GENERATE.has(actor.role)) {
      throw new DomainError(ErrorCode.Forbidden, 'Your role cannot create images', 403);
    }
    const { workspaceId } = actor;
    const replay = await this.prisma.withTenant(workspaceId, (tx) => this.findByKey(tx, workspaceId, idempotencyKey));
    if (replay) return toImageGeneration(replay);
    if (!this.available) {
      throw new DomainError(ErrorCode.Conflict, 'Image creation is not set up for this workspace yet', 409);
    }

    const brandId = await this.prisma.withTenant(workspaceId, (tx) => this.profiles.brandIdOf(tx, workspaceId));
    const context = await this.memory.visualContext(workspaceId, brandId, input.productId);
    if (input.productId && !context.product) {
      throw new DomainError(ErrorCode.Validation, 'That product was not found', 400, {
        fields: { productId: 'Choose one of your products' },
      });
    }
    const resolved = resolveInput(input, context);

    let created: GenerationRow;
    try {
      created = await this.prisma.withTenant(workspaceId, async (tx) => {
        await this.assertWithinLimits(tx, workspaceId, input.variants);
        const styleReferenceUrls = await this.references.pick(tx, brandId, context.recentPostUrls, {
          design: resolved.design,
          productId: context.product?.id ?? null,
        });
        return tx.studioGeneration.create({
          data: {
            workspaceId,
            brandId,
            createdByUserId: actor.userId,
            idempotencyKey,
            kind: 'image',
            input: resolved,
            productId: context.product?.id ?? null,
            productName: context.product?.name ?? null,
            requested: input.variants,
            styleReferenceUrls,
          },
          include: { outputs: true },
        });
      });
    } catch (error) {
      // Two requests with one key raced; the other one won and is the answer.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      const winner = await this.prisma.withTenant(workspaceId, (tx) => this.findByKey(tx, workspaceId, idempotencyKey));
      if (!winner) throw error;
      return toImageGeneration(winner);
    }

    const brief = { ...toImageBrief(resolved, context, created.styleReferenceUrls), layoutSeed: randomInt(LAYOUT_SEEDS) };
    const job = { generationId: created.id, workspaceId, brief, variants: input.variants };
    void this.runner.run(job).catch((error: unknown) => this.runner.fail(workspaceId, created.id, error));
    return toImageGeneration(created);
  }

  async get(principal: AuthPrincipal, id: string): Promise<ImageGeneration> {
    const found = await this.prisma.withTenant(principal.workspaceId, async (tx) => {
      await this.closeLost(tx);
      const row = await tx.studioGeneration.findFirst({ where: { id, kind: 'image' }, include: { outputs: true } });
      return row ? { row, states: await this.assetStates(tx, [row], principal.userId) } : null;
    });
    if (!found) throw new DomainError(ErrorCode.NotFound, 'Image request not found', 404);
    return toImageGeneration(found.row, found.states);
  }

  async list(principal: AuthPrincipal): Promise<ImageGenerationList> {
    const { workspaceId } = principal;
    const { rows, states, brandId } = await this.prisma.withTenant(workspaceId, async (tx) => {
      await this.closeLost(tx);
      const found = await tx.studioGeneration.findMany({
        where: { kind: 'image' },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        include: { outputs: true },
      });
      return {
        rows: found,
        states: await this.assetStates(tx, found, principal.userId),
        brandId: await this.profiles.brandIdOf(tx, workspaceId),
      };
    });
    const context = await this.memory.visualContext(workspaceId, brandId, null);
    return {
      generations: rows.map((row) => toImageGeneration(row, states)),
      available: this.available,
      defaults: { design: context.designStyle, hasLogo: context.logoUrl !== null },
    };
  }

  // Each output's library entry, with its star and the viewer's rating.
  private assetStates(tx: TenantTx, rows: GenerationRow[], userId: string): Promise<Map<string, OutputAssetState>> {
    return this.feedback.forStudioOutputs(tx, rows.flatMap((r) => r.outputs.map((o) => o.id)), userId);
  }

  private findByKey(tx: TenantTx, workspaceId: string, idempotencyKey: string): Promise<GenerationRow | null> {
    return tx.studioGeneration.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } },
      include: { outputs: true },
    });
  }

  // A spend guard until credits exist: images made in the last day plus those still being made.
  private async assertWithinLimits(tx: TenantTx, workspaceId: string, variants: number): Promise<void> {
    const since = new Date(Date.now() - DAY_MS);
    const [active, made] = await Promise.all([
      tx.studioGeneration.aggregate({
        where: { workspaceId, status: { in: [...ACTIVE] }, createdAt: { gt: new Date(Date.now() - STALE_AFTER_MS) } },
        _count: true,
        _sum: { requested: true },
      }),
      tx.studioOutput.count({ where: { workspaceId, createdAt: { gt: since } } }),
    ]);
    if (active._count >= MAX_ACTIVE_PER_WORKSPACE) {
      throw new DomainError(ErrorCode.RateLimited, 'Wait for your current images to finish, then try again', 429);
    }
    if (made + (active._sum.requested ?? 0) + variants > this.dailyLimit) {
      throw new DomainError(ErrorCode.RateLimited, 'You have reached today\'s image limit. Try again tomorrow', 429);
    }
  }

  private async closeLost(tx: TenantTx): Promise<void> {
    await tx.studioGeneration.updateMany({
      where: { status: { in: [...ACTIVE] }, createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
      data: { status: 'failed', errorCode: 'lost', message: LOST_MESSAGE, finishedAt: new Date() },
    });
  }
}
