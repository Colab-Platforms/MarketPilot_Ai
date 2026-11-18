import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode, TARGET_COMPETITORS, type ProfileResponse } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import {
  AiService,
  LlmError,
  domainOf,
  marketOf,
  type AiCompetitor,
  type CompetitorDiscoveryInput,
} from '@/modules/ai';
import { BrandProfileService } from '@/modules/brand';
import { CrawlerPort } from '../crawler/crawler.port';
import { parsePage } from '../crawler/parse-page';
import { loadRobots } from '../crawler/robots';
import { isStale } from './competitor-mapping';

const HOME_FETCH = { maxBytes: 1_500_000, timeoutMs: 10_000, accept: 'text/html' };

const FAILED_MESSAGE = 'We could not search for competitors right now. Try again in a few minutes.';

function resultMessage(found: number): string | null {
  if (found >= TARGET_COMPETITORS) return null;
  if (found === 0) return 'We could not confirm any competitors from the web. Add the ones you know below.';
  return `We found ${found} ${found === 1 ? 'competitor' : 'competitors'} we could confirm. Add any others you know below.`;
}

const GENERIC_WORDS = new Set([
  'the', 'and', 'india', 'indian', 'health', 'healthcare', 'wellness', 'care', 'nutrition', 'naturals', 'natural',
  'herbal', 'herbals', 'ayurveda', 'ayurvedic', 'foods', 'products', 'limited', 'ltd', 'pvt', 'private', 'company',
  'brand', 'store', 'shop', 'official', 'online', 'labs', 'life',
]);

// The brand's distinctive words must appear in the page title, site name or domain.
export function carriesName(page: { title: string | null; openGraph: Record<string, string> }, competitor: AiCompetitor): boolean {
  const words = competitor.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
  if (words.length === 0) return false;
  const haystack = [page.title, page.openGraph['og:site_name'], page.openGraph['og:title'], competitor.domain]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return words.some((w) => haystack.includes(w));
}

function profileValue(profile: ProfileResponse, key: string): string | string[] | null {
  const value = profile.sections.flatMap((s) => s.fields).find((f) => f.key === key)?.value;
  return typeof value === 'string' || Array.isArray(value) ? value : null;
}
const asText = (v: string | string[] | null) => (typeof v === 'string' ? v : null);
const asList = (v: string | string[] | null) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []);

// Finds competitors once per workspace with AI web search (ADR 0007). Results are only
// suggestions; the owner keeps or removes each one.
@Injectable()
export class CompetitorDiscoveryService {
  private readonly logger = new Logger(CompetitorDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly profiles: BrandProfileService,
    private readonly crawler: CrawlerPort,
  ) {}

  async start(workspaceId: string, brandId: string): Promise<void> {
    if (!this.ai.available) throw new DomainError(ErrorCode.Conflict, 'Finding competitors is not set up yet', 409);

    const runId = await this.prisma.withTenant(workspaceId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`competitors:${workspaceId}`}))`;
      const existing = await tx.competitorDiscovery.findUnique({ where: { workspaceId } });
      const retryable = existing && (isStale(existing) || (existing.status === 'failed' && existing.found === 0));
      if (existing && !retryable) {
        if (existing.status === 'running') return null;
        throw new DomainError(ErrorCode.Conflict, 'Competitors were already found for this business. Add or edit them below.', 409);
      }
      const data = { brandId, status: 'running' as const, found: 0, message: null, startedAt: new Date(), finishedAt: null };
      const row = existing
        ? await tx.competitorDiscovery.update({ where: { id: existing.id }, data })
        : await tx.competitorDiscovery.create({ data: { workspaceId, ...data } });
      return row.id;
    });
    if (!runId) return;

    void this.execute(runId, workspaceId, brandId).catch((error: unknown) => {
      this.logger.error(`Competitor discovery ${runId} failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return this.finish(workspaceId, runId, { status: 'failed', found: 0, message: FAILED_MESSAGE });
    });
  }

  private async execute(runId: string, workspaceId: string, brandId: string): Promise<void> {
    const input = await this.prisma.withTenant(workspaceId, (tx) => this.context(tx, workspaceId, brandId));
    let result;
    try {
      result = await this.ai.discoverCompetitors(input);
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      this.logger.warn(`Competitor discovery ${runId}: ${error.reason} ${error.message}`);
      return this.finish(workspaceId, runId, { status: 'failed', found: 0, message: FAILED_MESSAGE });
    }

    const confirmed = (await Promise.all(result.competitors.map((c) => this.confirm(c)))).filter(
      (c): c is AiCompetitor & { logoUrl: string | null } => c !== null,
    );
    await this.prisma.withTenant(workspaceId, (tx) =>
      tx.brandCompetitor.createMany({
        data: confirmed.map((c) => ({
          workspaceId,
          brandId,
          name: c.name,
          websiteUrl: c.websiteUrl,
          domain: c.domain,
          logoUrl: c.logoUrl,
          summary: c.summary,
          whySimilar: c.whySimilar,
          offerings: c.offerings,
          priceRange: c.priceRange,
          positioning: c.positioning,
          evidence: c.evidence,
          sourceType: 'ai_inferred' as const,
          status: 'candidate' as const,
        })),
        skipDuplicates: true,
      }),
    );
    await this.finish(workspaceId, runId, {
      status: 'completed',
      found: confirmed.length,
      message: resultMessage(confirmed.length),
      model: result.usage.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      costUsd: result.usage.costUsd,
    });
  }

  // A competitor is kept only if its website opens; its homepage also gives the logo and,
  // when the search said nothing, a one-line summary. One named only from the model's
  // knowledge must also carry its name there, so a wrong website is caught. robots.txt is respected.
  private async confirm(competitor: AiCompetitor): Promise<(AiCompetitor & { logoUrl: string | null }) | null> {
    try {
      const robots = await loadRobots(this.crawler, new URL(competitor.websiteUrl).origin);
      if (!robots.isAllowed('/')) return competitor.grounding === 'search' ? { ...competitor, logoUrl: null } : null;
      const home = await this.crawler.fetch(competitor.websiteUrl, HOME_FETCH);
      if (home.status >= 400) return null;
      const page = parsePage(home.body, home.url);
      if (competitor.grounding === 'knowledge' && !carriesName(page, competitor)) return null;
      return {
        ...competitor,
        logoUrl: page.logoUrl ?? page.iconUrl,
        summary: competitor.summary ?? page.description?.slice(0, 300) ?? null,
      };
    } catch {
      return null;
    }
  }

  private async context(
    tx: TenantTx,
    workspaceId: string,
    brandId: string,
  ): Promise<CompetitorDiscoveryInput> {
    const [profile, products, services, known] = await Promise.all([
      this.profiles.read(tx, workspaceId),
      tx.brandProduct.findMany({ where: { brandId, status: { not: 'rejected' } }, select: { name: true }, take: 8 }),
      tx.brandService.findMany({ where: { brandId, status: { not: 'rejected' } }, select: { name: true }, take: 4 }),
      tx.brandCompetitor.findMany({ where: { brandId }, select: { name: true, domain: true } }),
    ]);
    const value = (key: string) => profileValue(profile, key);
    return {
      brandName: profile.brand.name,
      websiteUrl: profile.brand.websiteUrl,
      category: profile.brand.category,
      subcategory: asText(value('subcategory')),
      description: asText(value('description')),
      offerings: [...products, ...services].map((o) => o.name),
      market: marketOf({
        city: asText(value('city')),
        country: asText(value('country')),
        serviceAreas: asList(value('serviceAreas')),
        audienceLocations: asList(value('audienceLocations')),
        salesChannels: asList(value('salesChannels')),
        operatingModel: asText(value('operatingModel')),
        onlineStoreUrl: asText(value('onlineStoreUrl')),
      }),
      audience: asText(value('audienceSummary')),
      knownCompetitors: [...new Set([...known.map((k) => k.name), ...asList(value('competitors'))])],
      knownDomains: [
        ...known.flatMap((k) => (k.domain ? [k.domain] : [])),
        ...asList(value('competitorWebsites')).flatMap((w) => domainOf(w) ?? []),
      ],
      wanted: TARGET_COMPETITORS + 1,
    };
  }

  private finish(
    workspaceId: string,
    runId: string,
    data: {
      status: 'completed' | 'failed';
      found: number;
      message: string | null;
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
      costUsd?: number | null;
    },
  ): Promise<void> {
    return this.prisma
      .withTenant(workspaceId, (tx) =>
        tx.competitorDiscovery.update({ where: { id: runId }, data: { ...data, finishedAt: new Date() } }),
      )
      .then(() => undefined);
  }
}
