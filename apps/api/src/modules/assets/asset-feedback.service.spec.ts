import type { PrismaService, TenantTx } from '@/infra/prisma';
import { AssetFeedbackService } from './asset-feedback.service';
import type { AssetActor } from './assets.service';

const owner: AssetActor = { workspaceId: 'w1', userId: 'u1', role: 'owner' };
const client: AssetActor = { ...owner, role: 'client' };

function assetRow(extra: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    workspaceId: 'w1',
    brandId: 'b1',
    createdByUserId: 'u1',
    kind: 'image',
    source: 'generated',
    url: 'https://cdn.test/a1.png',
    mediaType: 'image/png',
    name: null,
    width: null,
    height: null,
    bytes: null,
    durationSeconds: null,
    studioOutputId: 'o1',
    styleReferenceAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
    feedback: [],
    ...extra,
  };
}

function setup(asset = assetRow()) {
  const tx = {
    asset: {
      findFirst: jest.fn().mockResolvedValue(asset),
      findUniqueOrThrow: jest.fn().mockResolvedValue(asset),
      update: jest.fn().mockResolvedValue(asset),
    },
    assetFeedback: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma = { withTenant: (_w: string, work: (t: TenantTx) => unknown) => work(tx as unknown as TenantTx) } as unknown as PrismaService;
  return { service: new AssetFeedbackService(prisma), tx };
}

describe('AssetFeedbackService', () => {
  it('lets any role rate, and keeps reasons only with a dislike', async () => {
    const { service, tx } = setup();
    await service.setFeedback(client, 'a1', { rating: 'like', reasons: ['too_busy'] });
    expect(tx.assetFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ rating: 'like', reasons: [], userId: 'u1' }) }),
    );
    await service.setFeedback(client, 'a1', { rating: 'dislike', reasons: ['too_busy', 'text_wrong'] });
    expect(tx.assetFeedback.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ update: { rating: 'dislike', reasons: ['too_busy', 'text_wrong'] } }),
    );
  });

  it('clears the viewer\'s feedback on a null rating', async () => {
    const { service, tx } = setup();
    await service.setFeedback(owner, 'a1', { rating: null, reasons: [] });
    expect(tx.assetFeedback.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'a1', userId: 'u1' } });
  });

  it('only rates images made with AI', async () => {
    const { service } = setup(assetRow({ source: 'upload' }));
    await expect(service.setFeedback(owner, 'a1', { rating: 'like', reasons: [] })).rejects.toMatchObject({ status: 400 });
  });

  it('keeps the first star date and clears it when unstarred', async () => {
    const first = new Date('2026-11-01T00:00:00Z');
    const { service, tx } = setup(assetRow({ styleReferenceAt: first }));
    await service.setStyleReference(owner, 'a1', true);
    expect(tx.asset.update.mock.calls[0][0].data).toEqual({ styleReferenceAt: first });
    await service.setStyleReference(owner, 'a1', false);
    expect(tx.asset.update.mock.calls[1][0].data).toEqual({ styleReferenceAt: null });
  });

  it('does not let a client choose style references, or star a video', async () => {
    await expect(setup().service.setStyleReference(client, 'a1', true)).rejects.toMatchObject({ status: 403 });
    await expect(setup(assetRow({ kind: 'video' })).service.setStyleReference(owner, 'a1', true)).rejects.toMatchObject({
      status: 400,
    });
  });
});
