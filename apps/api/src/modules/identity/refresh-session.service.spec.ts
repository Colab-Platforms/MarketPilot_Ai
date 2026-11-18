import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import type { PrismaService } from '@/infra/prisma';
import { RefreshSessionService } from './refresh-session.service';

interface Row {
  id: string;
  userId: string;
  workspaceId: string;
  tokenHash: string;
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

// Minimal in-memory stand-in for the authSession delegate.
function fakePrisma() {
  const rows = new Map<string, Row>();
  let counter = 0;
  const delegate = {
    create: ({ data }: { data: Omit<Row, 'id' | 'previousTokenHash' | 'rotatedAt' | 'revokedAt'> }) => {
      const id = `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
      const row: Row = { ...data, id, previousTokenHash: null, rotatedAt: null, revokedAt: null };
      rows.set(id, row);
      return Promise.resolve(row);
    },
    findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(rows.get(where.id) ?? null),
    updateMany: ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      const row = rows.get(where.id as string);
      const hashOk = where.tokenHash === undefined || row?.tokenHash === where.tokenHash;
      const revokedOk = where.revokedAt === undefined || row?.revokedAt === where.revokedAt;
      if (!row || !hashOk || !revokedOk) return Promise.resolve({ count: 0 });
      Object.assign(row, data);
      return Promise.resolve({ count: 1 });
    },
  };
  return { rows, prisma: { authSession: delegate } as unknown as PrismaService };
}

const config = { get: () => 'p'.repeat(40) } as unknown as ConfigService<Env, true>;
const meta = { ipAddress: null, userAgent: null };

describe('RefreshSessionService', () => {
  it('rotates the token and issues a new one', async () => {
    const { prisma } = fakePrisma();
    const service = new RefreshSessionService(prisma, config);
    const first = await service.create('u1', 'w1', meta);

    const result = await service.rotate(first.token);

    expect(result.rotated?.token).toBeDefined();
    expect(result.rotated?.token).not.toBe(first.token);
    expect(result.userId).toBe('u1');
  });

  it('revokes the session when a rotated token is replayed after the grace window', async () => {
    const { prisma, rows } = fakePrisma();
    const service = new RefreshSessionService(prisma, config);
    const first = await service.create('u1', 'w1', meta);
    const second = (await service.rotate(first.token)).rotated!;
    rows.get(first.sessionId)!.rotatedAt = new Date(Date.now() - 60_000);

    await expect(service.rotate(first.token)).rejects.toMatchObject({ status: 401 });
    expect(rows.get(first.sessionId)!.revokedAt).not.toBeNull();
    await expect(service.rotate(second.token)).rejects.toMatchObject({ status: 401 });
  });

  it('accepts the previous token inside the grace window without rotating again', async () => {
    const { prisma } = fakePrisma();
    const service = new RefreshSessionService(prisma, config);
    const first = await service.create('u1', 'w1', meta);
    const winner = (await service.rotate(first.token)).rotated!;

    const loser = await service.rotate(first.token);

    expect(loser.rotated).toBeNull();
    expect((await service.rotate(winner.token)).rotated).not.toBeNull();
  });

  it('rejects an expired session', async () => {
    const { prisma, rows } = fakePrisma();
    const service = new RefreshSessionService(prisma, config);
    const issued = await service.create('u1', 'w1', meta);
    rows.get(issued.sessionId)!.expiresAt = new Date(Date.now() - 1000);

    await expect(service.rotate(issued.token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects malformed and missing tokens', async () => {
    const service = new RefreshSessionService(fakePrisma().prisma, config);
    await expect(service.rotate(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(service.rotate('nope')).rejects.toMatchObject({ status: 401 });
  });

  it('logout revokes the session', async () => {
    const { prisma } = fakePrisma();
    const service = new RefreshSessionService(prisma, config);
    const issued = await service.create('u1', 'w1', meta);

    await service.revokeByToken(issued.token);

    await expect(service.rotate(issued.token)).rejects.toMatchObject({ status: 401 });
  });
});
