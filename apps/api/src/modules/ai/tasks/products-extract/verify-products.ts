import { z } from 'zod';
import { normalizeForMatch, type EvidencePack } from '../profile-extract/evidence';

export interface AiProduct {
  name: string;
  description?: string;
  category?: string;
  priceMinor?: number;
  currency?: string;
  imageUrl?: string;
  sourceUrl: string;
}

const MAX_PRODUCTS = 30;
const MIN_QUOTE = 8;
const SUSPICIOUS = /(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)|system prompt|you are (now )?an? (ai|assistant|language model)|as an ai\b/i;

const answerSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      category: z.string(),
      price: z.string(),
      image: z.string(),
      evidence: z.string(),
    }),
  ),
});

// The model's list is a claim. A product is kept only if its name and its quote are
// really on a page we sent; a price only if that number is on the page; an image only
// if it is one the crawler found there.
export function verifyProducts(raw: unknown, pack: EvidencePack): AiProduct[] {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return [];

  const pages = pack.pages.map((page) => ({
    url: page.url,
    haystack: normalizeForMatch(
      `${page.title ?? ''} ${page.text} ${(page.images ?? []).map((i) => i.alt).join(' ')}`,
    ),
    digits: page.text.replace(/,/g, ''),
  }));
  const knownImages = new Set(pack.pages.flatMap((page) => (page.images ?? []).map((i) => i.src)));
  const seen = new Set<string>();
  const products: AiProduct[] = [];

  for (const item of parsed.data.products) {
    const name = item.name.trim().slice(0, 200);
    const key = name.toLowerCase();
    const normalName = normalizeForMatch(name);
    const quote = normalizeForMatch(item.evidence);
    if (name.length < 3 || seen.has(key) || quote.length < MIN_QUOTE) continue;
    if (SUSPICIOUS.test(name) || SUSPICIOUS.test(item.description)) continue;

    const source = pages.find((page) => page.haystack.includes(normalName) && page.haystack.includes(quote));
    if (!source) continue;
    seen.add(key);

    const number = Number(item.price.replace(/[^\d.]/g, ''));
    const priceOnPage = Number.isFinite(number) && number > 0 && new RegExp(`(^|[^\\d.])${String(number)}(\\.0+)?([^\\d]|$)`).test(source.digits);
    products.push({
      name,
      description: item.description.trim().slice(0, 500) || undefined,
      category: item.category.trim().slice(0, 120) || undefined,
      priceMinor: priceOnPage ? Math.round(number * 100) : undefined,
      currency: priceOnPage ? 'INR' : undefined,
      imageUrl: knownImages.has(item.image) ? item.image : undefined,
      sourceUrl: source.url,
    });
    if (products.length >= MAX_PRODUCTS) break;
  }
  return products;
}
