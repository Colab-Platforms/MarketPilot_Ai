import { Injectable } from '@nestjs/common';
import type { BrandProduct, BrandService, Prisma } from '@prisma/client';
import {
  ErrorCode,
  type ProductChange,
  type ProductItem,
  type ServiceChange,
  type ServiceItem,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { TenantTx } from '@/infra/prisma';
import { BrandMediaService } from './brand-media.service';

const LIST_LIMIT = 200;

export interface CatalogueActor {
  workspaceId: string;
  userId: string;
}

interface Ownership {
  sourceType: 'user_stated';
  sourceTrust: number;
  status: 'verified';
  verifiedAt: Date;
  verifiedByUserId: string;
}

type Attributes = Record<string, unknown>;
const attributesOf = (value: unknown): Attributes =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Attributes) } : {};
const isFeatured = (row: { attributes: unknown }) => attributesOf(row.attributes).featured === true;

function toProduct(row: BrandProduct): ProductItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceMinor: row.priceMinor,
    currency: row.currency,
    availability: row.availability,
    url: row.canonicalUrl,
    imageUrl: row.imageUrls[0] ?? null,
    imageUrls: row.imageUrls,
    featured: isFeatured(row),
    source: row.sourceType === 'crawled' ? 'website' : 'owner',
  };
}

function toService(row: BrandService): ServiceItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceMinor: row.priceMinor,
    currency: row.currency,
    durationMinutes: row.durationMinutes,
    benefits: row.benefits,
    bookingProcess: row.bookingProcess,
    featured: isFeatured(row),
    source: row.sourceType === 'crawled' ? 'website' : 'owner',
  };
}

function cleanUrl(raw: string | null): string | null | undefined {
  if (raw === null || raw === '') return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes('.') ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const toMinor = (price: number | null) => (price === null ? null : Math.round(price * 100));
const blankToNull = (value: string | null) => (value === '' ? null : value);

const notFound = (kind: 'product' | 'service') => new DomainError(ErrorCode.NotFound, `That ${kind} was not found`, 404);

// Field errors are keyed by position, so the form can mark the exact row and field.
const invalid = (fields: Record<string, string>) =>
  new DomainError(ErrorCode.Validation, 'Check the highlighted fields', 400, { fields });

@Injectable()
export class BrandCatalogueService {
  constructor(private readonly media: BrandMediaService) {}

  async list(tx: TenantTx, brandId: string): Promise<ProductItem[]> {
    const rows = await tx.brandProduct.findMany({
      where: { brandId, status: { not: 'rejected' } },
      orderBy: { name: 'asc' },
      take: LIST_LIMIT,
    });
    return rows.map(toProduct);
  }

  async listServices(tx: TenantTx, brandId: string): Promise<ServiceItem[]> {
    const rows = await tx.brandService.findMany({
      where: { brandId, status: { not: 'rejected' } },
      orderBy: { name: 'asc' },
      take: LIST_LIMIT,
    });
    return rows.map(toService);
  }

  // Applies the catalogue part of a profile update. Anything the owner writes is theirs,
  // whatever its origin, so it becomes verified and searchable.
  async apply(
    tx: TenantTx,
    brandId: string,
    actor: CatalogueActor,
    changes: { products: ProductChange[]; services: ServiceChange[] },
  ): Promise<void> {
    const errors: Record<string, string> = {};
    const owned: Ownership = {
      sourceType: 'user_stated',
      sourceTrust: 1,
      status: 'verified',
      verifiedAt: new Date(),
      verifiedByUserId: actor.userId,
    };
    const scope = { workspaceId: actor.workspaceId, brandId };

    for (const [index, change] of changes.products.entries()) {
      await this.applyProduct(tx, scope, owned, change, `products.${index}`, errors);
    }
    for (const [index, change] of changes.services.entries()) {
      await this.applyService(tx, scope, owned, change, `services.${index}`, errors);
    }
    if (Object.keys(errors).length > 0) throw invalid(errors);
  }

  private async applyProduct(
    tx: TenantTx,
    scope: { workspaceId: string; brandId: string },
    owned: Ownership,
    change: ProductChange,
    at: string,
    errors: Record<string, string>,
  ): Promise<void> {
    if (change.remove) {
      if (!change.id) return void (errors[`${at}.id`] = 'Choose which product to remove');
      const { count } = await tx.brandProduct.deleteMany({ where: { id: change.id, brandId: scope.brandId } });
      if (count === 0) throw notFound('product');
      return;
    }
    const url = change.url === undefined ? undefined : cleanUrl(change.url);
    if (change.url !== undefined && url === undefined) errors[`${at}.url`] = 'Enter a valid web address';

    const existing = change.id
      ? await tx.brandProduct.findFirst({ where: { id: change.id, brandId: scope.brandId } })
      : null;
    if (change.id && !existing) throw notFound('product');
    const imageUrls = change.imageUrls === undefined ? undefined : [...new Set(change.imageUrls)];
    // Images it already had (often read from the website) stay; anything new must be our upload.
    const isNewUpload = (u: string) => this.media.isUpload(u, 'product_image', scope.workspaceId);
    if (imageUrls?.some((u) => !existing?.imageUrls.includes(u) && !isNewUpload(u))) {
      errors[`${at}.imageUrls`] = 'Upload images here rather than linking them';
    }

    const data = {
      ...(change.name !== undefined && { name: change.name }),
      ...(change.description !== undefined && { description: blankToNull(change.description) }),
      ...(change.category !== undefined && { category: blankToNull(change.category) }),
      ...(change.price !== undefined && { priceMinor: toMinor(change.price) }),
      ...(change.availability !== undefined && { availability: change.availability }),
      ...(url !== undefined && { canonicalUrl: url }),
      ...(imageUrls !== undefined && { imageUrls }),
    };

    if (!existing) {
      if (!change.name) errors[`${at}.name`] = 'Enter a name';
      if (Object.keys(errors).some((key) => key.startsWith(`${at}.`))) return;
      await tx.brandProduct.create({
        data: { ...scope, ...owned, ...data, name: change.name as string, attributes: { featured: change.featured === true } },
      });
      return;
    }

    if (Object.keys(errors).some((key) => key.startsWith(`${at}.`))) return;
    const attributes = attributesOf(existing.attributes);
    if (change.featured !== undefined) attributes.featured = change.featured;
    await tx.brandProduct.update({
      where: { id: existing.id },
      data: { ...owned, ...data, attributes: attributes as Prisma.InputJsonValue },
    });
  }

  private async applyService(
    tx: TenantTx,
    scope: { workspaceId: string; brandId: string },
    owned: Ownership,
    change: ServiceChange,
    at: string,
    errors: Record<string, string>,
  ): Promise<void> {
    if (change.remove) {
      if (!change.id) return void (errors[`${at}.id`] = 'Choose which service to remove');
      const { count } = await tx.brandService.deleteMany({ where: { id: change.id, brandId: scope.brandId } });
      if (count === 0) throw notFound('service');
      return;
    }

    const data = {
      ...(change.name !== undefined && { name: change.name }),
      ...(change.description !== undefined && { description: blankToNull(change.description) }),
      ...(change.price !== undefined && { priceMinor: toMinor(change.price) }),
      ...(change.durationMinutes !== undefined && { durationMinutes: change.durationMinutes }),
      ...(change.benefits !== undefined && { benefits: change.benefits }),
      ...(change.bookingProcess !== undefined && { bookingProcess: blankToNull(change.bookingProcess) }),
    };

    if (!change.id) {
      if (!change.name) {
        errors[`${at}.name`] = 'Enter a name';
        return;
      }
      await tx.brandService.create({
        data: { ...scope, ...owned, ...data, name: change.name, attributes: { featured: change.featured === true } },
      });
      return;
    }

    const existing = await tx.brandService.findFirst({ where: { id: change.id, brandId: scope.brandId } });
    if (!existing) throw notFound('service');
    const attributes = attributesOf(existing.attributes);
    if (change.featured !== undefined) attributes.featured = change.featured;
    await tx.brandService.update({
      where: { id: change.id },
      data: { ...owned, ...data, attributes: attributes as Prisma.InputJsonValue },
    });
  }
}
