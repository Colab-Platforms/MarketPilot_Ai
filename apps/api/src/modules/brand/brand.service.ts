import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TenantTx } from '@/infra/prisma';
import { QUESTIONS } from '@marketpilot/contracts';
import type { BrandBasicsInput, BrandSnapshot, ProfilePatch, VerifiedField } from './brand.types';

type BrandWithProfile = Prisma.BrandGetPayload<{ include: { profile: true } }>;

const QUESTION_COLUMNS = [...new Set(QUESTIONS.filter((q) => q.store === 'column').map((q) => q.field))];

function knownValues(profile: BrandWithProfile['profile']): Record<string, string> {
  const known: Record<string, string> = {};
  for (const column of QUESTION_COLUMNS) {
    const value = (profile as Record<string, unknown> | null)?.[column];
    if (typeof value === 'string' && value !== '') known[column] = value;
  }
  return known;
}

function toSnapshot(brand: BrandWithProfile): BrandSnapshot {
  return {
    id: brand.id,
    name: brand.name,
    websiteUrl: brand.websiteUrl,
    city: brand.profile?.city ?? null,
    language: brand.languages[0] ?? 'en',
    known: knownValues(brand.profile),
  };
}

function asRecord(value: Prisma.JsonValue | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

@Injectable()
export class BrandService {
  async ensureInitialBrand(
    tx: TenantTx,
    workspace: { id: string; name: string },
  ): Promise<BrandSnapshot> {
    const existing = await tx.brand.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
      include: { profile: true },
    });
    if (existing) return toSnapshot(existing);

    const brand = await tx.brand.create({ data: { workspaceId: workspace.id, name: workspace.name } });
    await tx.brandProfile.create({ data: { brandId: brand.id, workspaceId: workspace.id } });
    return this.snapshot(tx, brand.id);
  }

  async applyBasics(
    tx: TenantTx,
    workspaceId: string,
    brandId: string,
    input: BrandBasicsInput,
  ): Promise<BrandSnapshot> {
    await tx.brand.update({
      where: { id: brandId },
      data: { name: input.name, websiteUrl: input.websiteUrl ?? null, languages: [input.language] },
    });
    await tx.brandProfile.upsert({
      where: { brandId },
      create: { brandId, workspaceId, city: input.city ?? null },
      update: { city: input.city ?? null, version: { increment: 1 } },
    });
    return this.snapshot(tx, brandId);
  }

  async applyProfile(
    tx: TenantTx,
    workspaceId: string,
    brandId: string,
    patch: ProfilePatch,
  ): Promise<void> {
    const profile = await tx.brandProfile.findUnique({ where: { brandId } });
    const attributes = { ...asRecord(profile?.attributes), ...patch.attributes };
    const stamp = { sourceType: 'user_stated', status: 'verified', verifiedAt: new Date().toISOString() };
    const provenance = asRecord(profile?.provenance);
    for (const field of [...Object.keys(patch.columns), ...Object.keys(patch.attributes)]) {
      provenance[field] = stamp;
    }

    // Column names come from the contracts question registry, not from request input.
    const data = {
      ...patch.columns,
      attributes: attributes as Prisma.InputJsonValue,
      provenance: provenance as Prisma.InputJsonValue,
    } as Prisma.BrandProfileUncheckedUpdateInput;

    await tx.brandProfile.upsert({
      where: { brandId },
      create: { ...data, brandId, workspaceId } as Prisma.BrandProfileUncheckedCreateInput,
      update: { ...data, version: { increment: 1 } },
    });

    if (typeof patch.columns.category === 'string') {
      await tx.brand.update({ where: { id: brandId }, data: { industry: patch.columns.category } });
    }
  }

  // Writes owner-approved values to profile columns. Column names are chosen by
  // callers from fixed whitelists (contracts), never from request input.
  async applyVerifiedFields(
    tx: TenantTx,
    workspaceId: string,
    brandId: string,
    fields: VerifiedField[],
  ): Promise<void> {
    if (fields.length === 0) return;
    const profile = await tx.brandProfile.findUnique({ where: { brandId } });
    const provenance = asRecord(profile?.provenance);
    const now = new Date().toISOString();
    const columns: Record<string, string> = {};
    for (const field of fields) {
      columns[field.column] = field.value;
      provenance[field.column] = {
        sourceType: field.sourceType,
        status: 'verified',
        verifiedAt: now,
        ...(field.sourceUrl && { sourceUrl: field.sourceUrl }),
        ...(field.sourceTrust !== undefined && { sourceTrust: field.sourceTrust }),
      };
    }
    const data = { ...columns, provenance: provenance as Prisma.InputJsonValue } as Prisma.BrandProfileUncheckedUpdateInput;
    await tx.brandProfile.upsert({
      where: { brandId },
      create: { ...data, brandId, workspaceId } as Prisma.BrandProfileUncheckedCreateInput,
      update: { ...data, version: { increment: 1 } },
    });
  }

  async snapshot(tx: TenantTx, brandId: string): Promise<BrandSnapshot> {
    const brand = await tx.brand.findUniqueOrThrow({ where: { id: brandId }, include: { profile: true } });
    return toSnapshot(brand);
  }
}
