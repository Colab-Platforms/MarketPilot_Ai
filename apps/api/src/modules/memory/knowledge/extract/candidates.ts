import type { ScanProfileField } from '@marketpilot/contracts';
import { socialProviderSchema } from '@marketpilot/contracts';
import type { ParsedPage } from '../crawler/parse-page';
import { normalizeWhitespace, socialFrom } from '../crawler/parse-page';
import { TRUST, type CandidateDraft, type ProductDraft } from './types';

const BUSINESS_TYPE = /(Organization|Business|Store|Restaurant|Salon|Clinic|School|Hotel|Shop|Gym|Dentist|Hospital|Pharmacy|Studio|Agency|Corporation)/i;
const MAX_PRODUCTS = 30;
const MAX_SOCIAL_PER_PROVIDER = 2;
const MAX_DESCRIPTION = 600;

type Json = Record<string, unknown>;

export interface ExtractionContext {
  // Profile fields the owner already stated; the scan never proposes over them.
  existing: Partial<Record<ScanProfileField, string | null>>;
  platformProducts: ProductDraft[];
  // Filled in with the fields the site had a value for but the owner already stated.
  alreadyKnown?: Set<ScanProfileField>;
}

function typesOf(node: Json): string[] {
  const raw = node['@type'];
  return (Array.isArray(raw) ? raw : [raw]).filter((t): t is string => typeof t === 'string');
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return normalizeWhitespace(value) || undefined;
  if (value && typeof value === 'object') {
    const record = value as Json;
    return str(record.name) ?? str(record.url) ?? str(record['@id']);
  }
  return undefined;
}

function firstOf(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function absoluteUrl(value: unknown, base: string): string | undefined {
  const raw = str(firstOf(value));
  if (!raw) return undefined;
  try {
    const url = new URL(raw, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function clipDescription(text: string): string {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > MAX_DESCRIPTION * 0.5) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function businessNodes(pages: ParsedPage[]): { node: Json; page: ParsedPage }[] {
  return pages.flatMap((page) =>
    page.jsonLd.filter((node) => typesOf(node).some((t) => BUSINESS_TYPE.test(t))).map((node) => ({ node, page })),
  );
}

function profileCandidates(pages: ParsedPage[], context: ExtractionContext): CandidateDraft[] {
  const found = new Map<ScanProfileField, CandidateDraft & { kind: 'business_profile' }>();
  const offer = (
    field: ScanProfileField,
    value: string | undefined,
    sourceUrl: string,
    method: 'json_ld' | 'meta_tag' | 'page_link' | 'page_element',
    trust: number,
  ): void => {
    if (!value) return;
    if (context.existing[field]) {
      context.alreadyKnown?.add(field);
      return;
    }
    const current = found.get(field);
    if (current && current.trust >= trust) return;
    found.set(field, {
      kind: 'business_profile',
      field,
      value: field === 'description' ? clipDescription(value) : value,
      sourceUrl,
      method,
      trust,
    });
  };

  for (const { node, page } of businessNodes(pages)) {
    offer('description', str(node.description), page.url, 'json_ld', TRUST.jsonLd);
    offer('contactPhone', str(node.telephone), page.url, 'json_ld', TRUST.jsonLd);
    offer('contactEmail', str(node.email)?.replace(/^mailto:/i, ''), page.url, 'json_ld', TRUST.jsonLd);
    offer('logoUrl', absoluteUrl(node.logo, page.url), page.url, 'json_ld', TRUST.jsonLd);
    const address = firstOf(node.address);
    if (address && typeof address === 'object') {
      const a = address as Json;
      offer('addressLine', str(a.streetAddress), page.url, 'json_ld', TRUST.jsonLd);
      offer('city', str(a.addressLocality), page.url, 'json_ld', TRUST.jsonLd);
      offer('state', str(a.addressRegion), page.url, 'json_ld', TRUST.jsonLd);
      offer('postalCode', str(a.postalCode), page.url, 'json_ld', TRUST.jsonLd);
    }
  }

  const home = pages[0];
  if (home) {
    offer('description', home.description ?? undefined, home.url, 'meta_tag', TRUST.metaTag);
    // Most small-business sites have no JSON-LD logo, but show one in their header.
    offer('logoUrl', home.logoUrl ?? undefined, home.url, 'page_element', TRUST.pageElement);
    offer('logoUrl', home.iconUrl ?? undefined, home.url, 'meta_tag', TRUST.siteIcon);
  }

  // The contact page is the most reliable place for contact links.
  const contactFirst = [...pages].sort((a, b) => Number(/contact/i.test(b.url)) - Number(/contact/i.test(a.url)));
  for (const page of contactFirst) {
    offer('contactEmail', page.emails[0], page.url, 'page_link', TRUST.pageLink);
    offer('contactPhone', page.phones[0], page.url, 'page_link', TRUST.pageLink);
  }
  return [...found.values()];
}

function socialCandidates(pages: ParsedPage[]): CandidateDraft[] {
  const perProvider = new Map<string, number>();
  const seen = new Set<string>();
  const out: CandidateDraft[] = [];
  const add = (provider: string, url: string, sourceUrl: string, method: 'json_ld' | 'page_link', trust: number) => {
    const parsed = socialProviderSchema.safeParse(provider);
    if (!parsed.success || seen.has(`${provider}:${url}`)) return;
    if ((perProvider.get(provider) ?? 0) >= MAX_SOCIAL_PER_PROVIDER) return;
    seen.add(`${provider}:${url}`);
    perProvider.set(provider, (perProvider.get(provider) ?? 0) + 1);
    out.push({ kind: 'social_link', provider: parsed.data, url, sourceUrl, method, trust });
  };
  // `sameAs` is the business's own declaration of its profiles, so it goes first.
  for (const { node, page } of businessNodes(pages)) {
    const sameAs = Array.isArray(node.sameAs) ? node.sameAs : node.sameAs ? [node.sameAs] : [];
    for (const link of sameAs) {
      const social = typeof link === 'string' ? socialFrom(link) : null;
      if (social) add(social.provider, social.url, page.url, 'json_ld', TRUST.jsonLd);
    }
  }
  for (const page of pages) {
    for (const { provider, url } of page.socials) add(provider, url, page.url, 'page_link', TRUST.pageLink);
  }
  return out;
}

function offerOf(node: Json): Json | undefined {
  const offers = firstOf(node.offers);
  return offers && typeof offers === 'object' ? (offers as Json) : undefined;
}

function productFromJsonLd(node: Json, page: ParsedPage, currency: string | null): ProductDraft | null {
  const name = str(node.name);
  if (!name) return null;
  const offer = offerOf(node);
  const price = offer?.price ?? offer?.lowPrice;
  const priceNumber = typeof price === 'string' ? Number.parseFloat(price) : typeof price === 'number' ? price : NaN;
  const availability = str(offer?.availability) ?? '';
  return {
    name: name.slice(0, 200),
    description: str(node.description)?.slice(0, 500),
    priceMinor: Number.isFinite(priceNumber) && priceNumber >= 0 ? Math.round(priceNumber * 100) : undefined,
    currency: str(offer?.priceCurrency) ?? currency ?? undefined,
    imageUrl: absoluteUrl(node.image, page.url),
    url: absoluteUrl(node.url, page.url) ?? page.canonicalUrl,
    sku: str(node.sku),
    category: str(node.category),
    availability: /InStock/i.test(availability) ? 'in_stock' : /OutOfStock|SoldOut/i.test(availability) ? 'out_of_stock' : 'unknown',
  };
}

function productCandidates(pages: ParsedPage[], context: ExtractionContext): CandidateDraft[] {
  const byKey = new Map<string, CandidateDraft>();
  const keyOf = (p: ProductDraft) => (p.url ?? p.name).toLowerCase();
  const names = new Set<string>();

  for (const product of context.platformProducts) {
    byKey.set(keyOf(product), {
      kind: 'product',
      product,
      sourceUrl: product.url ?? pages[0]?.url ?? '',
      method: 'platform_api',
      trust: TRUST.platformApi,
    });
    names.add(product.name.toLowerCase());
  }
  for (const page of pages) {
    for (const node of page.jsonLd.filter((n) => typesOf(n).includes('Product'))) {
      const product = productFromJsonLd(node, page, page.currency);
      if (!product || names.has(product.name.toLowerCase()) || byKey.has(keyOf(product))) continue;
      names.add(product.name.toLowerCase());
      byKey.set(keyOf(product), { kind: 'product', product, sourceUrl: page.url, method: 'json_ld', trust: TRUST.jsonLd });
    }
  }
  return [...byKey.values()].slice(0, MAX_PRODUCTS);
}

// Deterministic extraction only: every candidate comes from structured data or an
// explicit link, so there is nothing for page text to inject instructions into.
export function buildCandidates(pages: ParsedPage[], context: ExtractionContext): CandidateDraft[] {
  return [
    ...profileCandidates(pages, context),
    ...socialCandidates(pages),
    ...productCandidates(pages, context),
  ];
}
