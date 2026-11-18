import { DomainError } from '@/common';
import type { TenantTx } from '@/infra/prisma';
import type { MediaStoragePort } from '@/infra/storage';
import { BrandCatalogueService } from './brand-catalogue.service';
import { BrandMediaService } from './brand-media.service';

const actor = { workspaceId: 'w1', userId: 'u1' };
const none = { products: [], services: [] };

function fakeTx(existing: Record<string, unknown> | null = null) {
  const product = {
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(existing),
    deleteMany: jest.fn().mockResolvedValue({ count: existing ? 1 : 0 }),
  };
  const service = { create: jest.fn().mockResolvedValue({}), update: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() };
  return { tx: { brandProduct: product, brandService: service } as unknown as TenantTx, product, service };
}

const UPLOADED = 'https://res.cloudinary.com/c/image/upload/v1/marketpilot_products/w1/a.jpg';
const storage = {
  isAvailable: () => true,
  createUploadTicket: jest.fn(),
  ownsUrl: (url: string, folder: string) => url.includes(`/${folder}/`),
} as unknown as MediaStoragePort;
const media = new BrandMediaService(storage);

describe('BrandCatalogueService.apply', () => {
  const catalogue = new BrandCatalogueService(media);

  it('saves uploaded images in the order given', async () => {
    const { tx, product } = fakeTx();
    await catalogue.apply(tx, 'b1', actor, { ...none, products: [{ name: 'Gummies', imageUrls: [UPLOADED] }] });
    expect(product.create.mock.calls[0][0].data.imageUrls).toEqual([UPLOADED]);
  });

  it('keeps images the product already had, such as ones read from the website', async () => {
    const crawled = 'https://shop.example.com/gummies.png';
    const { tx, product } = fakeTx({ id: 'p1', attributes: {}, imageUrls: [crawled] });
    await catalogue.apply(tx, 'b1', actor, { ...none, products: [{ id: 'p1', imageUrls: [UPLOADED, crawled] }] });
    expect(product.update.mock.calls[0][0].data.imageUrls).toEqual([UPLOADED, crawled]);
  });

  it('does not accept a logo upload as a product image', async () => {
    const { tx } = fakeTx();
    const logo = 'https://res.cloudinary.com/c/image/upload/v1/marketpilot_brand/w1/a.png';
    const error = await catalogue
      .apply(tx, 'b1', actor, { ...none, products: [{ name: 'X', imageUrls: [logo] }] })
      .catch((e: unknown) => e);
    expect(JSON.stringify((error as DomainError).details)).toContain('products.0.imageUrls');
  });

  it('rejects image links that are not our uploads for this workspace', async () => {
    const { tx, product } = fakeTx();
    const other = 'https://res.cloudinary.com/c/image/upload/v1/marketpilot_products/w2/a.jpg';
    const error = await catalogue
      .apply(tx, 'b1', actor, { ...none, products: [{ name: 'X', imageUrls: [other] }] })
      .catch((e: unknown) => e);
    expect(JSON.stringify((error as DomainError).details)).toContain('products.0.imageUrls');
    expect(product.create).not.toHaveBeenCalled();
  });

  it('creates a product as owner-verified, with the price in paise', async () => {
    const { tx, product } = fakeTx();
    await catalogue.apply(tx, 'b1', actor, {
      ...none,
      products: [{ name: 'Gummies', price: 499.5, featured: true }],
    });
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'w1',
        brandId: 'b1',
        name: 'Gummies',
        priceMinor: 49950,
        sourceType: 'user_stated',
        status: 'verified',
        verifiedByUserId: 'u1',
        attributes: { featured: true },
      }),
    });
  });

  it('creates a service with its duration and how to book', async () => {
    const { tx, service } = fakeTx();
    await catalogue.apply(tx, 'b1', actor, {
      ...none,
      services: [{ name: 'Consultation', durationMinutes: 30, bookingProcess: 'Call us' }],
    });
    expect(service.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Consultation', durationMinutes: 30, bookingProcess: 'Call us' }),
    });
  });

  it('edits only the fields sent and keeps other attributes', async () => {
    const { tx, product } = fakeTx({ id: 'p1', attributes: { featured: false, other: 1 } });
    await catalogue.apply(tx, 'b1', actor, { ...none, products: [{ id: 'p1', featured: true }] });
    const { data } = product.update.mock.calls[0][0];
    expect(data.attributes).toEqual({ featured: true, other: 1 });
    expect(data).not.toHaveProperty('name');
  });

  it('rejects creating a product without a name, keyed to its row', async () => {
    const { tx, product } = fakeTx();
    const error = await catalogue
      .apply(tx, 'b1', actor, { ...none, products: [{ name: 'Ok' }, { price: 10 }] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect(JSON.stringify((error as DomainError).details)).toContain('products.1.name');
    expect(product.create).toHaveBeenCalledTimes(1);
  });

  it('refuses to edit a product from another brand', async () => {
    const { tx } = fakeTx(null);
    await expect(catalogue.apply(tx, 'b1', actor, { ...none, products: [{ id: 'x', name: 'Y' }] })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('removes by id within the brand', async () => {
    const { tx, product } = fakeTx({ id: 'p1' });
    await catalogue.apply(tx, 'b1', actor, { ...none, products: [{ id: 'p1', remove: true }] });
    expect(product.deleteMany).toHaveBeenCalledWith({ where: { id: 'p1', brandId: 'b1' } });
  });
});
