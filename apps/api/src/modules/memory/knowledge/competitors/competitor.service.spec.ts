import type { CompetitorDiscovery } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TenantTx } from '@/infra/prisma';
import { DomainError } from '@/common';
import { carriesName } from './competitor-discovery.service';
import { toDiscovery } from './competitor-mapping';
import { CompetitorService } from './competitor.service';

const actor = { workspaceId: 'w1', userId: 'u1' };

function fakeTx(existing: Record<string, unknown> | null = null, count = 0) {
  const competitor = {
    count: jest.fn().mockResolvedValue(count),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(existing),
    deleteMany: jest.fn().mockResolvedValue({ count: existing ? 1 : 0 }),
  };
  return { tx: { brandCompetitor: competitor } as unknown as TenantTx, competitor };
}

describe('CompetitorService', () => {
  const service = new CompetitorService({} as never);

  it('adds an owner competitor as verified, with a clean website and domain', async () => {
    const { tx, competitor } = fakeTx();
    await service.add(tx, actor, 'b1', { name: 'Muditam', websiteUrl: 'WWW.Muditam.com/shop', offerings: ['A', 'A'] });
    expect(competitor.create.mock.calls[0][0].data).toMatchObject({
      name: 'Muditam',
      websiteUrl: 'https://muditam.com/',
      domain: 'muditam.com',
      offerings: ['A'],
      sourceType: 'user_stated',
      status: 'verified',
      verifiedByUserId: 'u1',
    });
  });

  it('rejects a website that is not a real address', async () => {
    const { tx } = fakeTx();
    const error = await service.add(tx, actor, 'b1', { name: 'X', websiteUrl: 'not a site' }).catch((e: unknown) => e);
    expect(JSON.stringify((error as DomainError).details)).toContain('websiteUrl');
  });

  it('stops at the list limit', async () => {
    const { tx } = fakeTx(null, 15);
    await expect(service.add(tx, actor, 'b1', { name: 'X' })).rejects.toMatchObject({ status: 409 });
  });

  it('reports the same competitor twice as a conflict', async () => {
    const { tx, competitor } = fakeTx();
    competitor.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.add(tx, actor, 'b1', { name: 'X', websiteUrl: 'x.com' })).rejects.toMatchObject({ status: 409 });
  });

  it('keeps a suggestion when the owner keeps or edits it', async () => {
    const { tx, competitor } = fakeTx({ id: 'c1' });
    await service.update(tx, actor, 'b1', 'c1', { keep: true });
    expect(competitor.update.mock.calls[0][0].data).toMatchObject({ status: 'verified', verifiedByUserId: 'u1' });
    expect(competitor.update.mock.calls[0][0].data).not.toHaveProperty('keep');
  });

  it('refuses to change a competitor of another brand', async () => {
    const { tx } = fakeTx(null);
    await expect(service.update(tx, actor, 'b1', 'x', { name: 'Y' })).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(tx, 'b1', 'x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('carriesName (homepage check for brands named from knowledge)', () => {
  const competitor = (name: string, domain: string) =>
    ({ name, domain, grounding: 'knowledge' }) as unknown as Parameters<typeof carriesName>[1];
  const page = (title: string, siteName?: string) => ({
    title,
    openGraph: (siteName ? { 'og:site_name': siteName } : {}) as Record<string, string>,
  });

  it('accepts a homepage that carries the brand name', () => {
    expect(carriesName(page('Kapiva | Ayurvedic Health Products'), competitor('Kapiva', 'kapiva.in'))).toBe(true);
    expect(carriesName(page('Home', 'Himalaya Wellness'), competitor('Himalaya Wellness', 'himalaya.example'))).toBe(true);
  });

  it('rejects a website that belongs to someone else', () => {
    expect(carriesName(page('Buy Domains Cheap'), competitor('Kapiva', 'parked-domain.com'))).toBe(false);
  });

  it('does not count generic words like "health" or "naturals" as a match', () => {
    expect(carriesName(page('Natural Health Store'), competitor('Organic Health Naturals', 'shop.example'))).toBe(false);
  });
});

describe('competitor discovery runs once per workspace', () => {
  const run = (patch: Partial<CompetitorDiscovery>): CompetitorDiscovery => ({
    id: 'r1',
    workspaceId: 'w1',
    brandId: 'b1',
    status: 'completed',
    found: 4,
    message: null,
    model: null,
    promptTokens: 0,
    completionTokens: 0,
    costUsd: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    ...patch,
  });

  it('can start when it never ran', () => {
    expect(toDiscovery(null)).toEqual({ status: 'not_started', message: null, canStart: true });
  });

  it('cannot start again once it finished, even if it found nobody', () => {
    expect(toDiscovery(run({})).canStart).toBe(false);
    expect(toDiscovery(run({ found: 0 })).canStart).toBe(false);
  });

  it('may retry only a run that failed before finding anyone, or one lost to a restart', () => {
    expect(toDiscovery(run({ status: 'failed', found: 0 })).canStart).toBe(true);
    expect(toDiscovery(run({ status: 'failed', found: 2 })).canStart).toBe(false);
    expect(toDiscovery(run({ status: 'running', startedAt: new Date(Date.now() - 10 * 60_000) }))).toMatchObject({
      status: 'failed',
      canStart: true,
    });
    expect(toDiscovery(run({ status: 'running' })).canStart).toBe(false);
  });
});
