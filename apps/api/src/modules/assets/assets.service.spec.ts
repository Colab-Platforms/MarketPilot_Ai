import { ASSET_PAGE_SIZE } from '@marketpilot/contracts';
import type { PrismaService, TenantTx } from '@/infra/prisma';
import type { MediaStoragePort } from '@/infra/storage';
import type { BrandProfileService } from '@/modules/brand';
import { decodeCursor, encodeCursor } from './asset.mapper';
import { AssetsService, libraryFolder, type AssetActor } from './assets.service';

const owner: AssetActor = { workspaceId: 'w1', userId: 'u1', role: 'owner' };
const analyst: AssetActor = { ...owner, role: 'analyst' };

function row(index: number) {
  return {
    id: `0193a000-0000-7000-8000-${String(index).padStart(12, '0')}`,
    workspaceId: 'w1',
    brandId: 'b1',
    createdByUserId: 'u1',
    kind: 'image' as const,
    source: 'upload' as const,
    url: `https://cdn.test/${libraryFolder('w1')}/${index}.jpg`,
    mediaType: null,
    name: null,
    width: null,
    height: null,
    bytes: null,
    durationSeconds: null,
    studioOutputId: null,
    styleReferenceAt: null,
    createdAt: new Date(Date.UTC(2026, 10, 20, 0, 0, index)),
    updatedAt: new Date(0),
    deletedAt: null,
  };
}

function setup() {
  const asset = {
    findMany: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  };
  const tx = { asset } as unknown as TenantTx;
  const prisma = { withTenant: jest.fn((_w: string, work: (t: TenantTx) => unknown) => work(tx)) } as unknown as PrismaService;
  const storage = {
    isAvailable: () => true,
    createUploadTicket: jest.fn(),
    ownsUrl: jest.fn((url: string, folder: string) => url.includes(`/${folder}/`)),
  } as unknown as MediaStoragePort;
  const profiles = { brandIdOf: jest.fn().mockResolvedValue('b1') } as unknown as BrandProfileService;
  return { service: new AssetsService(prisma, storage, profiles), asset, tx, storage };
}

describe('asset cursor', () => {
  it('round-trips the time and id', () => {
    const cursor = { createdAt: new Date('2026-11-20T10:00:00.123Z'), id: 'abc' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects garbage', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
  });
});

describe('AssetsService', () => {
  it('returns a next cursor only when another page exists', async () => {
    const { service, asset } = setup();
    asset.findMany.mockResolvedValue(Array.from({ length: ASSET_PAGE_SIZE + 1 }, (_, i) => row(i)));
    const full = await service.list(owner, {});
    expect(full.assets).toHaveLength(ASSET_PAGE_SIZE);
    expect(full.nextCursor).toBe(encodeCursor(row(ASSET_PAGE_SIZE - 1)));

    asset.findMany.mockResolvedValue([row(1)]);
    expect((await service.list(owner, {})).nextCursor).toBeNull();
  });

  it('hides removed files and applies the filters', async () => {
    const { service, asset } = setup();
    asset.findMany.mockResolvedValue([]);
    await service.list(owner, { kind: 'video', source: 'upload' });
    expect(asset.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, kind: 'video', source: 'upload' });
  });

  it('refuses a URL that was not uploaded to this workspace library', async () => {
    const { service, asset } = setup();
    await expect(
      service.create(owner, { kind: 'image', url: 'https://cdn.test/marketpilot_library/w2/x.jpg', name: null, width: null, height: null, bytes: null, durationSeconds: null }),
    ).rejects.toMatchObject({ status: 400 });
    expect(asset.upsert).not.toHaveBeenCalled();
  });

  it('checks video URLs as videos', async () => {
    const { service, asset, storage } = setup();
    asset.upsert.mockResolvedValue({ ...row(1), kind: 'video' });
    const url = `https://cdn.test/${libraryFolder('w1')}/clip.mp4`;
    await service.create(owner, { kind: 'video', url, name: 'clip.mp4', width: 1080, height: 1920, bytes: 10, durationSeconds: 12.5 });
    expect(storage.ownsUrl).toHaveBeenCalledWith(url, libraryFolder('w1'), 'video');
  });

  it('does not let an analyst upload or remove', async () => {
    const { service } = setup();
    expect(() => service.uploadTicket(analyst, 'image')).toThrow(expect.objectContaining({ status: 403 }));
    await expect(service.remove(analyst, 'x')).rejects.toMatchObject({ status: 403 });
  });

  it('answers not found when there is nothing to remove', async () => {
    const { service, asset } = setup();
    asset.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(owner, 'x')).rejects.toMatchObject({ status: 404 });
  });

  it('records generated outputs as generated images linked to their output', async () => {
    const { service, asset, tx } = setup();
    await service.recordGenerated(tx, {
      workspaceId: 'w1',
      brandId: 'b1',
      createdByUserId: 'u1',
      outputs: [{ id: 'o1', url: 'https://cdn.test/g/1.png', mediaType: 'image/png', width: 1, height: 2 }],
    });
    expect(asset.createMany.mock.calls[0][0]).toEqual({
      data: [expect.objectContaining({ source: 'generated', kind: 'image', studioOutputId: 'o1' })],
      skipDuplicates: true,
    });
  });
});
