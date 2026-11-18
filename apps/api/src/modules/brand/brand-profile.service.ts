import { Injectable } from '@nestjs/common';
import { Prisma, type BrandScale } from '@prisma/client';
import { ErrorCode, canSkipSection, type ProfileResponse } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { TenantTx } from '@/infra/prisma';
import { buildProfileResponse, type ProfileData } from './profile-read';
import { planProfileWrites, type WritePlan } from './profile-write';

type Json = Record<string, unknown>;
const asJson = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Json) } : {});

export interface ProfileActor {
  workspaceId: string;
  userId: string;
}

// Where a saved value came from. Typing a value yourself is the default.
export interface ProfileStamp {
  sourceType: 'user_stated' | 'crawled' | 'ai_inferred';
  sourceUrl?: string | null;
  sourceTrust?: number;
}

export interface ApprovedEntry {
  key: string;
  value: unknown;
  stamp: ProfileStamp;
}

export type ApplyApprovedResult = { ok: true } | { ok: false; errors: Record<string, string> };

@Injectable()
export class BrandProfileService {
  // The first brand of the workspace; multi-brand arrives with the enterprise tier.
  async brandIdOf(tx: TenantTx, workspaceId: string): Promise<string> {
    const brand = await tx.brand.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!brand) throw new DomainError(ErrorCode.NotFound, 'Finish setting up your workspace first', 404);
    return brand.id;
  }

  async read(tx: TenantTx, workspaceId: string): Promise<ProfileResponse> {
    return buildProfileResponse(await this.load(tx, workspaceId));
  }

  async update(tx: TenantTx, actor: ProfileActor, values: Record<string, unknown>): Promise<ProfileResponse> {
    const data = await this.load(tx, actor.workspaceId);
    const category = typeof data.profile?.category === 'string' ? data.profile.category : null;
    const result = planProfileWrites(
      { track: data.accountType, category, languages: data.brand.languages },
      values,
    );
    if (!result.ok) {
      throw new DomainError(ErrorCode.Validation, 'Check the highlighted fields', 400, { fields: result.errors });
    }
    await this.apply(tx, actor, data, result.plan);
    return this.read(tx, actor.workspaceId);
  }

  // Switches a section off (not relevant to this business) or back on. Values in it are kept.
  async setSectionSkipped(tx: TenantTx, actor: ProfileActor, sectionId: string, skipped: boolean): Promise<ProfileResponse> {
    if (!canSkipSection(sectionId)) {
      throw new DomainError(ErrorCode.Validation, 'This section cannot be turned off', 400);
    }
    const brandId = await this.brandIdOf(tx, actor.workspaceId);
    const current = await tx.brandProfile.findUnique({ where: { brandId }, select: { skippedSections: true } });
    const next = new Set(current?.skippedSections ?? []);
    if (skipped) next.add(sectionId);
    else next.delete(sectionId);
    await tx.brandProfile.upsert({
      where: { brandId },
      create: { brandId, workspaceId: actor.workspaceId, skippedSections: [...next] },
      update: { skippedSections: [...next] },
    });
    return this.read(tx, actor.workspaceId);
  }

  // Writes values the owner approved from a website scan. They go through exactly the
  // same checks and storage rules as a manual edit; only the recorded origin differs.
  async applyApproved(tx: TenantTx, actor: ProfileActor, entries: ApprovedEntry[]): Promise<ApplyApprovedResult> {
    if (entries.length === 0) return { ok: true };
    const data = await this.load(tx, actor.workspaceId);
    const category = typeof data.profile?.category === 'string' ? data.profile.category : null;
    const result = planProfileWrites(
      { track: data.accountType, category, languages: data.brand.languages },
      Object.fromEntries(entries.map((e) => [e.key, e.value])),
    );
    if (!result.ok) return { ok: false, errors: result.errors };
    await this.apply(tx, actor, data, result.plan, new Map(entries.map((e) => [e.key, e.stamp])));
    return { ok: true };
  }

  private async load(tx: TenantTx, workspaceId: string): Promise<ProfileData> {
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const brand = await tx.brand.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      include: { profile: true },
    });
    if (!brand) throw new DomainError(ErrorCode.NotFound, 'Finish setting up your workspace first', 404);
    const [socials, policies, products] = await Promise.all([
      tx.brandSocialAccount.findMany({ where: { brandId: brand.id, status: { not: 'rejected' } } }),
      tx.brandPolicy.findMany({ where: { brandId: brand.id, status: { not: 'rejected' } } }),
      tx.brandProduct.findMany({ where: { brandId: brand.id, status: { not: 'rejected' } } }),
    ]);
    return {
      accountType: workspace.accountType,
      brand: {
        id: brand.id,
        name: brand.name,
        websiteUrl: brand.websiteUrl,
        scale: brand.scale,
        languages: brand.languages,
      },
      profile: brand.profile as Json | null,
      socials,
      policies,
      products,
    };
  }

  private async apply(
    tx: TenantTx,
    actor: ProfileActor,
    data: ProfileData,
    plan: WritePlan,
    stamps: ReadonlyMap<string, ProfileStamp> = new Map(),
  ): Promise<void> {
    const brandId = data.brand.id;
    const { brand } = plan;

    if (Object.keys(brand).length > 0 || plan.categoryChanged) {
      await tx.brand.update({
        where: { id: brandId },
        data: {
          ...(brand.name !== undefined && { name: brand.name }),
          ...(brand.websiteUrl !== undefined && { websiteUrl: brand.websiteUrl }),
          ...(brand.scale !== undefined && { scale: brand.scale as BrandScale }),
          ...(brand.languages !== undefined && { languages: brand.languages }),
          ...(plan.categoryChanged && { industry: plan.category }),
        },
      });
    }
    if (brand.name !== undefined) {
      await tx.workspace.update({ where: { id: actor.workspaceId }, data: { name: brand.name } });
    }

    const attributes = asJson(data.profile?.attributes);
    Object.assign(attributes, plan.attributes.set);
    for (const key of plan.attributes.remove) delete attributes[key];

    const provenance = asJson(data.profile?.provenance);
    const verifiedAt = new Date().toISOString();
    for (const key of plan.stamped) {
      const origin = stamps.get(key);
      provenance[key] = {
        sourceType: origin?.sourceType ?? 'user_stated',
        status: 'verified',
        verifiedAt,
        ...(origin?.sourceUrl && { sourceUrl: origin.sourceUrl }),
        ...(origin?.sourceTrust !== undefined && { sourceTrust: origin.sourceTrust }),
      };
    }
    for (const key of plan.cleared) delete provenance[key];

    const profileData = {
      ...plan.columns,
      attributes: attributes as Prisma.InputJsonValue,
      provenance: provenance as Prisma.InputJsonValue,
    } as Prisma.BrandProfileUncheckedUpdateInput;
    await tx.brandProfile.upsert({
      where: { brandId },
      create: { ...profileData, brandId, workspaceId: actor.workspaceId } as Prisma.BrandProfileUncheckedCreateInput,
      update: { ...profileData, version: { increment: 1 } },
    });

    for (const change of plan.social) {
      await this.writeSocial(tx, actor, data, change, stamps.get(`social.${change.provider}`));
    }
    for (const change of plan.policies) {
      await this.writePolicy(tx, actor, brandId, change, stamps.get(`policy.${change.kind}`));
    }
  }

  // Each platform field holds one profile link: the one shown first. Editing it
  // changes that link in place and leaves any other approved profile alone.
  private async writeSocial(
    tx: TenantTx,
    actor: ProfileActor,
    data: ProfileData,
    change: WritePlan['social'][number],
    origin?: ProfileStamp,
  ): Promise<void> {
    const brandId = data.brand.id;
    const rows = await tx.brandSocialAccount.findMany({
      where: { brandId, provider: change.provider, status: { not: 'rejected' } },
      orderBy: { createdAt: 'asc' },
    });
    const primary = [...rows].sort((a, b) => Number(b.status === 'verified') - Number(a.status === 'verified'))[0];

    if (change.url === null) {
      if (primary) await tx.brandSocialAccount.delete({ where: { id: primary.id } });
      return;
    }
    const url = change.url.replace(/\/+$/, '');
    const handle = url.split('/').filter(Boolean).pop()?.replace(/^@/, '') ?? null;
    const now = new Date();
    const owned = {
      sourceType: origin?.sourceType ?? ('user_stated' as const),
      status: 'verified' as const,
      verifiedAt: now,
      verifiedByUserId: actor.userId,
      sourceTrust: origin?.sourceTrust ?? 1,
      ...(origin?.sourceUrl && { sourceUrl: origin.sourceUrl }),
    };

    const duplicate = rows.find((r) => r.profileUrl === url);
    if (duplicate) {
      if (primary && primary.id !== duplicate.id) await tx.brandSocialAccount.delete({ where: { id: primary.id } });
      await tx.brandSocialAccount.update({ where: { id: duplicate.id }, data: owned });
    } else if (primary) {
      await tx.brandSocialAccount.update({ where: { id: primary.id }, data: { profileUrl: url, handle, ...owned } });
    } else {
      await tx.brandSocialAccount.create({
        data: { workspaceId: actor.workspaceId, brandId, provider: change.provider, profileUrl: url, handle, ...owned },
      });
    }
  }

  private async writePolicy(
    tx: TenantTx,
    actor: ProfileActor,
    brandId: string,
    change: WritePlan['policies'][number],
    origin?: ProfileStamp,
  ): Promise<void> {
    if (change.content === null) {
      await tx.brandPolicy.deleteMany({ where: { brandId, kind: change.kind } });
      return;
    }
    const owned = {
      sourceType: origin?.sourceType ?? ('user_stated' as const),
      status: 'verified' as const,
      verifiedAt: new Date(),
      verifiedByUserId: actor.userId,
      sourceTrust: origin?.sourceTrust ?? 1,
      ...(origin?.sourceUrl && { sourceUrl: origin.sourceUrl }),
    };
    const existing = await tx.brandPolicy.findFirst({ where: { brandId, kind: change.kind }, orderBy: { createdAt: 'asc' } });
    if (existing) {
      await tx.brandPolicy.update({ where: { id: existing.id }, data: { content: change.content, ...owned } });
    } else {
      await tx.brandPolicy.create({
        data: { workspaceId: actor.workspaceId, brandId, kind: change.kind, content: change.content, ...owned },
      });
    }
  }
}
