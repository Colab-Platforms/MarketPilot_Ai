import * as cheerio from 'cheerio';
import { CrawlerPort } from './crawler.port';
import type { RobotsRules } from './robots';
import type { ProductDraft } from '../extract/types';

const PRODUCT_LIMIT = 24;

export type Platform = 'shopify' | 'woocommerce' | 'wordpress' | 'wix' | 'squarespace';

export function detectPlatform(hints: string[]): Platform | null {
  for (const platform of ['shopify', 'woocommerce', 'wordpress', 'wix', 'squarespace'] as const) {
    if (hints.includes(platform)) return platform;
  }
  return null;
}

function plainText(html: string | undefined, max = 500): string | undefined {
  if (!html) return undefined;
  const text = cheerio.load(html).text().replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : undefined;
}

function toMinor(price: unknown): number | undefined {
  const value = typeof price === 'string' ? Number.parseFloat(price) : typeof price === 'number' ? price : NaN;
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : undefined;
}

async function getJson(crawler: CrawlerPort, url: string): Promise<unknown> {
  const response = await crawler.fetch(url, { maxBytes: 1_500_000, timeoutMs: 10_000, accept: 'application/json' });
  if (response.status !== 200 || response.truncated) return null;
  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  variants?: { price?: string; sku?: string; available?: boolean }[];
  images?: { src?: string }[];
}

// Shopify exposes catalogue JSON publicly: exact data, no scraping.
export async function fetchShopifyProducts(
  crawler: CrawlerPort,
  origin: string,
  currency: string | null,
  robots: RobotsRules,
): Promise<ProductDraft[]> {
  if (!robots.isAllowed('/products.json')) return [];
  const data = (await getJson(crawler, `${origin}/products.json?limit=${PRODUCT_LIMIT}`)) as {
    products?: ShopifyProduct[];
  } | null;
  return (data?.products ?? []).slice(0, PRODUCT_LIMIT).flatMap((product): ProductDraft[] => {
    if (!product.title) return [];
    const variant = product.variants?.[0];
    return [
      {
        externalId: product.id ? `shopify:${product.id}` : undefined,
        name: product.title.slice(0, 200),
        description: plainText(product.body_html),
        priceMinor: toMinor(variant?.price),
        currency: currency ?? 'INR',
        imageUrl: product.images?.[0]?.src,
        url: product.handle ? `${origin}/products/${product.handle}` : undefined,
        sku: variant?.sku || undefined,
        category: product.product_type || undefined,
        availability: product.variants?.some((v) => v.available) ? 'in_stock' : 'out_of_stock',
      },
    ];
  });
}

interface WooProduct {
  id?: number;
  name?: string;
  permalink?: string;
  sku?: string;
  short_description?: string;
  description?: string;
  prices?: { price?: string; currency_code?: string };
  images?: { src?: string }[];
  categories?: { name?: string }[];
  is_in_stock?: boolean;
}

export async function fetchWooProducts(
  crawler: CrawlerPort,
  origin: string,
  robots: RobotsRules,
): Promise<ProductDraft[]> {
  if (!robots.isAllowed('/wp-json/wc/store/v1/products')) return [];
  const data = (await getJson(crawler, `${origin}/wp-json/wc/store/v1/products?per_page=${PRODUCT_LIMIT}`)) as
    | WooProduct[]
    | null;
  if (!Array.isArray(data)) return [];
  return data.slice(0, PRODUCT_LIMIT).flatMap((product): ProductDraft[] => {
    if (!product.name) return [];
    // The Store API already returns prices in minor units.
    const minor = Number.parseInt(product.prices?.price ?? '', 10);
    return [
      {
        externalId: product.id ? `woo:${product.id}` : undefined,
        name: plainText(product.name, 200) ?? product.name,
        description: plainText(product.short_description) ?? plainText(product.description),
        priceMinor: Number.isFinite(minor) ? minor : undefined,
        currency: product.prices?.currency_code ?? 'INR',
        imageUrl: product.images?.[0]?.src,
        url: product.permalink,
        sku: product.sku || undefined,
        category: product.categories?.[0]?.name,
        availability: product.is_in_stock === false ? 'out_of_stock' : 'in_stock',
      },
    ];
  });
}
