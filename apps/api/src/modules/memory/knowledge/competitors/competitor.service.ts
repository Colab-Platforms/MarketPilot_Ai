import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  MAX_COMPETITORS,
  type CompetitorInput,
  type CompetitorList,
  type CreateCompetitorInput,
  type UpdateCompetitorInput,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { domainOf } from '@/modules/ai';
import { toCompetitor, toDiscovery } from './competitor-mapping';

export interface CompetitorActor {
  workspaceId: string;
  userId: string;
}

const notFound = () => new DomainError(ErrorCode.NotFound, 'That competitor was not found', 404);
const invalid = (fields: Record<string, string>) =>
  new DomainError(ErrorCode.Validation, 'Check the highlighted fields', 400, { fields });
const duplicate = () => new DomainError(ErrorCode.Conflict, 'That competitor is already in your list', 409);

const blankToNull = (value: string | null | undefined) => (value === '' ? null : value);

// The fields an owner can write, normalised. A website must parse to a real domain.
function columns(input: CompetitorInput): Prisma.BrandCompetitorUpdateInput {
  const out: Prisma.BrandCompetitorUpdateInput = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.websiteUrl !== undefined) {
    const url = blankToNull(input.websiteUrl);
    const domain = url ? domainOf(url) : null;
    if (url && !domain) throw invalid({ websiteUrl: 'Enter a valid web address' });
    out.websiteUrl = domain ? `https://${domain}/` : null;
    out.domain = domain;
  }
  if (input.summary !== undefined) out.summary = blankToNull(input.summary);
  if (input.offerings !== undefined) out.offerings = [...new Set(input.offerings)];
  if (input.priceRange !== undefined) out.priceRange = blankToNull(input.priceRange);
  if (input.positioning !== undefined) out.positioning = blankToNull(input.positioning);
  return out;
}

// Owner edits to the competitor list. Whatever the owner writes or keeps is theirs and
// becomes verified, so it joins the Brand Brain.
@Injectable()
export class CompetitorService {
  constructor(private readonly prisma: PrismaService) {}

  list(tx: TenantTx, workspaceId: string, brandId: string): Promise<CompetitorList> {
    return Promise.all([
      tx.brandCompetitor.findMany({
        where: { brandId, status: { in: ['candidate', 'verified'] } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.competitorDiscovery.findUnique({ where: { workspaceId } }),
    ]).then(([rows, discovery]) => ({ competitors: rows.map(toCompetitor), discovery: toDiscovery(discovery) }));
  }

  async add(tx: TenantTx, actor: CompetitorActor, brandId: string, input: CreateCompetitorInput): Promise<void> {
    const count = await tx.brandCompetitor.count({ where: { brandId, status: { in: ['candidate', 'verified'] } } });
    if (count >= MAX_COMPETITORS) {
      throw new DomainError(ErrorCode.Conflict, `You can list up to ${MAX_COMPETITORS} competitors`, 409);
    }
    const data = columns(input) as Prisma.BrandCompetitorUncheckedCreateInput;
    await this.write(() =>
      tx.brandCompetitor.create({
        data: {
          ...data,
          name: input.name,
          workspaceId: actor.workspaceId,
          brandId,
          sourceType: 'user_stated',
          status: 'verified',
          verifiedAt: new Date(),
          verifiedByUserId: actor.userId,
        },
      }),
    );
  }

  async update(tx: TenantTx, actor: CompetitorActor, brandId: string, id: string, input: UpdateCompetitorInput): Promise<void> {
    // `keep` only marks the suggestion as kept, which every update does anyway.
    const fields: CompetitorInput = {
      name: input.name,
      websiteUrl: input.websiteUrl,
      summary: input.summary,
      offerings: input.offerings,
      priceRange: input.priceRange,
      positioning: input.positioning,
    };
    const existing = await tx.brandCompetitor.findFirst({ where: { id, brandId, status: { in: ['candidate', 'verified'] } } });
    if (!existing) throw notFound();
    await this.write(() =>
      tx.brandCompetitor.update({
        where: { id: existing.id },
        data: { ...columns(fields), status: 'verified', verifiedAt: new Date(), verifiedByUserId: actor.userId },
      }),
    );
  }

  async remove(tx: TenantTx, brandId: string, id: string): Promise<void> {
    const { count } = await tx.brandCompetitor.deleteMany({ where: { id, brandId } });
    if (count === 0) throw notFound();
  }

  private async write(run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw duplicate();
      throw error;
    }
  }
}
