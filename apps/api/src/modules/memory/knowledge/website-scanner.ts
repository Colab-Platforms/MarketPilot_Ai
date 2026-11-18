import type { PageType } from '@prisma/client';
import type { ScanProfileField } from '@marketpilot/contracts';
import { CrawlerPort, FetchError, type FetchedResource } from './crawler/crawler.port';
import { classifyPath, planPages } from './crawler/discover';
import { parsePage, type ParsedPage } from './crawler/parse-page';
import { detectPlatform, fetchShopifyProducts, fetchWooProducts, type Platform } from './crawler/platforms';
import { loadRobots, RobotsRules } from './crawler/robots';
import { buildCandidates } from './extract/candidates';
import type { CandidateDraft, ProductDraft } from './extract/types';

export interface ScannedPage {
  parsed: ParsedPage;
  pageType: PageType;
  httpStatus: number;
  fetchedAt: Date;
}

export type ScanFailure = 'blocked' | 'robots' | 'unreachable' | 'not_html';

export interface ScanOutcome {
  platform: Platform | null;
  pages: ScannedPage[];
  candidates: CandidateDraft[];
  pagesDiscovered: number;
  pagesFailed: number;
  timedOut: boolean;
  failure: ScanFailure | null;
  // Details the site had that the owner had already entered, so none were proposed.
  alreadyKnown: number;
}

export interface ScanOptions {
  maxPages?: number;
  deadlineMs?: number;
  existing?: Partial<Record<ScanProfileField, string | null>>;
  onProgress?: (progress: { pagesDiscovered: number; pagesFetched: number }) => Promise<void> | void;
}

const CONCURRENCY = 3;
const isHtml = (r: FetchedResource) => /html/i.test(r.contentType) || r.contentType === '';

const empty = (failure: ScanFailure): ScanOutcome => ({
  platform: null,
  pages: [],
  candidates: [],
  pagesDiscovered: 0,
  pagesFailed: failure === 'unreachable' ? 1 : 0,
  timedOut: false,
  failure,
  alreadyKnown: 0,
});

export class WebsiteScanner {
  constructor(private readonly crawler: CrawlerPort) {}

  async scan(startUrl: string, options: ScanOptions = {}): Promise<ScanOutcome> {
    const maxPages = options.maxPages ?? 10;
    const deadline = Date.now() + (options.deadlineMs ?? 60_000);
    const start = new URL(startUrl);

    let robots: RobotsRules;
    try {
      robots = await loadRobots(this.crawler, start.origin);
    } catch (error) {
      if (error instanceof FetchError && error.reason === 'blocked') return empty('blocked');
      throw error;
    }
    if (!robots.isAllowed(start.pathname + start.search)) return empty('robots');

    const home = await this.fetchPage(startUrl);
    if (home instanceof FetchError) return empty(home.reason === 'blocked' ? 'blocked' : 'unreachable');
    if (home.status >= 400) return empty('unreachable');
    if (!isHtml(home)) return empty('not_html');

    const siteOrigin = new URL(home.url).origin;
    if (siteOrigin !== start.origin) robots = await loadRobots(this.crawler, siteOrigin).catch(() => RobotsRules.blockAll());

    const homePage = parsePage(home.body, home.url);
    const platform = detectPlatform(homePage.platformHints);
    const pages: ScannedPage[] = [toScanned(homePage, home.status)];
    const plan = planPages(home.url, homePage.links, maxPages - 1, robots);
    let pagesDiscovered = plan.length + 1;
    let pagesFailed = 0;
    let timedOut = false;
    await options.onProgress?.({ pagesDiscovered, pagesFetched: 1 });

    const productsPromise = this.platformProducts(platform, siteOrigin, homePage.currency, robots);

    for (let i = 0; i < plan.length; i += CONCURRENCY) {
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }
      const batch = plan.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((page) => this.fetchPage(page.url)));
      results.forEach((result, index) => {
        const planned = batch[index]!;
        if (result instanceof FetchError || result.status >= 400 || !isHtml(result)) {
          if (planned.guessed) pagesDiscovered -= 1;
          else pagesFailed += 1;
          return;
        }
        pages.push(toScanned(parsePage(result.body, result.url), result.status));
      });
      await options.onProgress?.({ pagesDiscovered, pagesFetched: pages.length });
    }

    const platformProducts = await productsPromise;
    const alreadyKnown = new Set<ScanProfileField>();
    const candidates = buildCandidates(
      pages.map((p) => p.parsed),
      { existing: options.existing ?? {}, platformProducts, alreadyKnown },
    );
    return {
      platform,
      pages,
      candidates,
      pagesDiscovered,
      pagesFailed,
      timedOut,
      failure: null,
      alreadyKnown: alreadyKnown.size,
    };
  }

  private async fetchPage(url: string): Promise<FetchedResource | FetchError> {
    try {
      return await this.crawler.fetch(url, { accept: 'text/html,application/xhtml+xml' });
    } catch (error) {
      return error instanceof FetchError ? error : new FetchError('network', 'Fetch failed');
    }
  }

  private async platformProducts(
    platform: Platform | null,
    origin: string,
    currency: string | null,
    robots: RobotsRules,
  ): Promise<ProductDraft[]> {
    try {
      if (platform === 'shopify') return await fetchShopifyProducts(this.crawler, origin, currency, robots);
      if (platform === 'woocommerce') return await fetchWooProducts(this.crawler, origin, robots);
    } catch {
      // A missing catalogue endpoint is normal; JSON-LD on product pages still applies.
    }
    return [];
  }
}

function toScanned(parsed: ParsedPage, httpStatus: number): ScannedPage {
  const path = new URL(parsed.url).pathname;
  const hasProduct = parsed.jsonLd.some((node) => JSON.stringify(node['@type'] ?? '').includes('Product'));
  return {
    parsed,
    httpStatus,
    pageType: hasProduct && classifyPath(path) === 'other' ? 'product' : classifyPath(path),
    fetchedAt: new Date(),
  };
}
