import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, WebsiteScan } from '@prisma/client';
import {
  ErrorCode,
  PROFILE_FIELDS,
  SCAN_FIELD_LABELS,
  SCAN_PROFILE_FIELDS,
  type AiStatus,
  type ScanCandidate,
  type ScanStage,
  type ScanState,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { BrandProfileService } from '@/modules/brand';
import { payloadToCandidate } from './candidate-payload';
import type { CandidateDraft } from './extract/types';
import { EmbeddingService } from './embedding.service';
import { AI_SKIPPED, ProfileSuggester, type AiRun, type AiRunSummary } from './profile-suggester';
import { WebsiteScanner, type ScanFailure, type ScanOutcome } from './website-scanner';

// A scan runs in this process for now (no queue yet). One that has not finished by
// then was lost to a restart, so it is closed out instead of spinning forever.
const STALE_AFTER_MS = 3 * 60_000;

const FAILURE_MESSAGES: Record<ScanFailure, string> = {
  robots: 'This website asks automated tools not to read it, so we skipped it. You can add your details yourself instead.',
  blocked: 'We could not open this address. Check that it is a public website, or add your details yourself.',
  unreachable: 'We could not reach this website. Check the address, or add your details yourself.',
  not_html: 'This address is not a web page. Check it, or add your details yourself.',
};
const FEW_DETAILS_MESSAGE =
  'We read your website but found few details we could use. Sites built mostly with scripts, or with very little text, often look like this. You can add your details yourself.';

const nothingNewMessage = (pages: number) =>
  `We read ${pages} ${pages === 1 ? 'page' : 'pages'} of your website. The details we could find are already in your profile, so there is nothing new to add.`;

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: WebsiteScanner,
    private readonly profiles: BrandProfileService,
    private readonly suggester: ProfileSuggester,
    private readonly embeddings: EmbeddingService,
  ) {}

  async start(workspaceId: string, brandId: string, force: boolean): Promise<ScanState> {
    const { scan, created } = await this.prisma.withTenant(workspaceId, async (tx) => {
      // One scan decision at a time per brand, so two tabs cannot start two scans.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`scan:${brandId}`}))`;
      const brand = await tx.brand.findUniqueOrThrow({ where: { id: brandId } });
      if (!brand.websiteUrl) {
        throw new DomainError(ErrorCode.Conflict, 'Add your website address first', 409);
      }
      const url = brand.websiteUrl;

      const latest = await tx.websiteScan.findFirst({
        where: { brandId, normalizedUrl: url },
        orderBy: { createdAt: 'desc' },
      });
      if (latest && isActive(latest) && !isStale(latest)) return { scan: latest, created: false };
      if (latest && isActive(latest)) await this.close(tx, latest.id, 'failed', 'timeout', 'The scan did not finish.');
      if (latest && !force && !isActive(latest) && (latest.status === 'completed' || latest.status === 'partial')) {
        return { scan: latest, created: false };
      }

      const count = await tx.websiteScan.count({ where: { brandId } });
      const scan = await tx.websiteScan.create({
        data: {
          workspaceId,
          brandId,
          requestedUrl: url,
          normalizedUrl: url,
          status: 'queued',
          idempotencyKey: `scan:${count + 1}`,
        },
      });
      return { scan, created: true };
    });

    if (created) {
      void this.execute(scan.id, workspaceId, brandId, scan.normalizedUrl).catch((error: unknown) => {
        this.logger.error(`Scan ${scan.id} crashed: ${error instanceof Error ? error.message : 'unknown'}`);
        return this.fail(workspaceId, scan.id, 'internal', 'Something went wrong while reading your website.');
      });
    }
    return this.state(workspaceId, brandId, scan.id);
  }

  async latest(workspaceId: string, brandId: string): Promise<ScanState | null> {
    const scan = await this.prisma.withTenant(workspaceId, async (tx) => {
      const latest = await tx.websiteScan.findFirst({ where: { brandId }, orderBy: { createdAt: 'desc' } });
      if (latest && isActive(latest) && isStale(latest)) {
        await this.close(tx, latest.id, 'failed', 'timeout', 'The scan did not finish.');
      }
      return latest;
    });
    return scan ? this.state(workspaceId, brandId, scan.id) : null;
  }

  private async state(workspaceId: string, brandId: string, scanId: string): Promise<ScanState> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      const scan = await tx.websiteScan.findUniqueOrThrow({ where: { id: scanId } });
      const ready = scan.status === 'completed' || scan.status === 'partial';
      const rows = ready
        ? await tx.knowledgeExtraction.findMany({
            where: { brandId, status: 'candidate', document: { scanId } },
            orderBy: { createdAt: 'asc' },
          })
        : [];
      const candidates = rows.flatMap((row): ScanCandidate[] => {
        const candidate = payloadToCandidate(row.id, row.kind, row.payload);
        return candidate ? [candidate] : [];
      });
      return {
        id: scan.id,
        status: scan.status,
        url: scan.normalizedUrl,
        platform: scan.platform,
        pagesFetched: scan.pagesFetched,
        pagesDiscovered: scan.pagesDiscovered,
        stage: stageOf(scan),
        ai: aiOf(scan),
        message: scan.errorMessage,
        candidates: orderCandidates(candidates),
      };
    });
  }

  private async execute(scanId: string, workspaceId: string, brandId: string, url: string): Promise<void> {
    const context = await this.prisma.withTenant(workspaceId, async (tx) => {
      await tx.websiteScan.update({
        where: { id: scanId },
        data: { status: 'running', startedAt: new Date(), config: { stage: 'reading' } },
      });
      const profile = await tx.brandProfile.findUnique({ where: { brandId } });
      const read = await this.profiles.read(tx, workspaceId);
      const fields = read.sections.flatMap((section) => section.fields);
      const valueOf = (key: string) => {
        const value = fields.find((f) => f.key === key)?.value;
        return typeof value === 'string' ? value : null;
      };
      return {
        existing: Object.fromEntries(
          SCAN_PROFILE_FIELDS.map((field) => [field, (profile?.[field] as string | null | undefined) ?? null]),
        ),
        // Anything already filled in is never asked of the AI, so it cannot be overwritten.
        knownKeys: new Set(fields.filter((f) => f.editable && f.status !== 'missing').map((f) => f.key)),
        brandName: read.brand.name,
        accountType: read.brand.accountType,
        category: read.brand.category,
        city: valueOf('city'),
      };
    });

    const outcome = await this.scanner.scan(url, {
      existing: context.existing,
      onProgress: ({ pagesDiscovered, pagesFetched }) =>
        this.prisma
          .withTenant(workspaceId, (tx) =>
            tx.websiteScan.update({ where: { id: scanId }, data: { pagesDiscovered, pagesFetched } }),
          )
          .then(() => undefined),
    });

    let ai: AiRun = AI_SKIPPED;
    if (!outcome.failure && outcome.pages.length > 0) {
      await this.prisma.withTenant(workspaceId, (tx) =>
        tx.websiteScan.update({ where: { id: scanId }, data: { config: { stage: 'understanding' } } }),
      );
      // The crawler's own finds (structured data, links) win over the AI for the same field.
      const covered = outcome.candidates.flatMap((c) => (c.kind === 'business_profile' ? [c.field] : []));
      ai = await this.suggester.suggest({
        pages: outcome.pages,
        brandName: context.brandName,
        accountType: context.accountType,
        category: context.category,
        city: context.city,
        skipKeys: new Set([...context.knownKeys, ...covered]),
        // Only when the site gave no structured catalogue (Shopify, WooCommerce, JSON-LD).
        readProducts: !outcome.candidates.some((c) => c.kind === 'product'),
      });
    }

    await this.prisma.withTenant(workspaceId, (tx) => this.persist(tx, scanId, workspaceId, brandId, url, outcome, ai));

    // Search indexing runs after the owner can already review, and never blocks or fails the scan.
    if (!outcome.failure) {
      void this.embeddings.indexBrand(workspaceId, brandId).catch((error: unknown) => {
        this.logger.warn(`Indexing failed: ${error instanceof Error ? error.message : 'unknown'}`);
      });
    }
  }

  private async persist(
    tx: TenantTx,
    scanId: string,
    workspaceId: string,
    brandId: string,
    url: string,
    outcome: ScanOutcome,
    ai: AiRun,
  ): Promise<void> {
    if (outcome.failure) {
      await this.close(tx, scanId, 'failed', outcome.failure, FAILURE_MESSAGES[outcome.failure], {
        pagesFailed: outcome.pagesFailed,
      });
      return;
    }

    const source = await tx.knowledgeSource.upsert({
      where: { brandId_kind_uri: { brandId, kind: 'website', uri: new URL(url).origin } },
      create: { workspaceId, brandId, kind: 'website', uri: new URL(url).origin, lastFetchedAt: new Date() },
      update: { lastFetchedAt: new Date() },
    });

    const documentIds = new Map<string, string>();
    for (const page of outcome.pages) {
      const previous = await tx.knowledgeDocument.findFirst({
        where: { sourceId: source.id, canonicalUrl: page.parsed.canonicalUrl },
        orderBy: { version: 'desc' },
      });
      if (previous) {
        await tx.knowledgeDocument.updateMany({
          where: { sourceId: source.id, canonicalUrl: page.parsed.canonicalUrl, state: 'active' },
          data: { state: 'superseded' },
        });
      }
      const document = await tx.knowledgeDocument.create({
        data: {
          workspaceId,
          brandId,
          sourceId: source.id,
          scanId,
          url: page.parsed.url,
          canonicalUrl: page.parsed.canonicalUrl,
          pageType: page.pageType,
          title: page.parsed.title,
          language: page.parsed.language,
          httpStatus: page.httpStatus,
          content: page.parsed.text,
          contentHash: page.parsed.textHash,
          metadata: { footerText: page.parsed.footerText },
          version: (previous?.version ?? 0) + 1,
          fetchedAt: page.fetchedAt,
        },
      });
      documentIds.set(page.parsed.url, document.id);
    }

    // A rescan replaces what was proposed before; approved facts are untouched.
    await tx.knowledgeExtraction.updateMany({
      where: { brandId, status: 'candidate' },
      data: { status: 'stale' },
    });
    const homeDocumentId = documentIds.values().next().value as string;
    await tx.knowledgeExtraction.createMany({
      data: [
        ...ai.drafts.map((draft) => ({
          workspaceId,
          brandId,
          documentId: (draft.sourceUrl && documentIds.get(draft.sourceUrl)) || homeDocumentId,
          kind: 'profile_field' as const,
          method: 'llm',
          schemaVersion: 1,
          payload: { ...draft } as Prisma.InputJsonValue,
          model: ai.summary.model,
          promptVersion: ai.summary.promptVersion,
          // Rule-based like every other trust score: a quoted fact outranks a judgement.
          sourceTrust: draft.basis === 'stated' ? 0.6 : 0.4,
        })),
        ...ai.products.map((product) => ({
          workspaceId,
          brandId,
          documentId: documentIds.get(product.sourceUrl) ?? homeDocumentId,
          kind: 'product' as const,
          method: 'llm',
          schemaVersion: 1,
          payload: { ...product } as Prisma.InputJsonValue,
          model: ai.summary.model,
          promptVersion: ai.summary.promptVersion,
          // Name and quote are verified against the page, but it is still a reading, not an API.
          sourceTrust: 0.55,
        })),
        ...outcome.candidates.map((candidate) => ({
        workspaceId,
        brandId,
        documentId: documentIds.get(candidate.sourceUrl) ?? homeDocumentId,
        kind: candidate.kind,
        method: candidate.method,
        schemaVersion: 1,
          payload: draftPayload(candidate) as Prisma.InputJsonValue,
          sourceTrust: candidate.trust,
        })),
      ],
    });

    const empty = outcome.candidates.length + ai.drafts.length + ai.products.length === 0;
    const nothingNew = empty && outcome.alreadyKnown > 0;
    // Having nothing new because everything is already filled in is a complete scan.
    const partial = (empty && !nothingNew) || outcome.timedOut || outcome.pagesFailed > 0;
    await tx.websiteScan.update({
      where: { id: scanId },
      data: {
        sourceId: source.id,
        status: partial ? 'partial' : 'completed',
        platform: outcome.platform,
        pagesDiscovered: outcome.pagesDiscovered,
        pagesFetched: outcome.pages.length,
        pagesFailed: outcome.pagesFailed,
        errorMessage: !empty ? null : nothingNew ? nothingNewMessage(outcome.pages.length) : FEW_DETAILS_MESSAGE,
        completeness: {
          profileFields: outcome.candidates.filter((c) => c.kind === 'business_profile').length,
          socialLinks: outcome.candidates.filter((c) => c.kind === 'social_link').length,
          products:
            outcome.candidates.filter((c) => c.kind === 'product').length + ai.products.length,
          aiSuggestions: ai.drafts.length,
          ai: ai.summary,
        } as unknown as Prisma.InputJsonValue,
        config: { stage: 'done' },
        finishedAt: new Date(),
      },
    });
  }

  private close(
    tx: TenantTx,
    scanId: string,
    status: 'failed',
    errorCode: string,
    errorMessage: string,
    extra: Partial<Pick<WebsiteScan, 'pagesFailed'>> = {},
  ) {
    return tx.websiteScan.update({
      where: { id: scanId },
      data: { status, errorCode, errorMessage, finishedAt: new Date(), ...extra },
    });
  }

  private fail(workspaceId: string, scanId: string, code: string, message: string): Promise<void> {
    return this.prisma
      .withTenant(workspaceId, (tx) => this.close(tx, scanId, 'failed', code, message))
      .then(() => undefined);
  }
}

function isActive(scan: WebsiteScan): boolean {
  return scan.status === 'queued' || scan.status === 'running';
}

function isStale(scan: WebsiteScan): boolean {
  return Date.now() - scan.createdAt.getTime() > STALE_AFTER_MS;
}

function draftPayload(candidate: CandidateDraft): Record<string, unknown> {
  switch (candidate.kind) {
    case 'business_profile':
      return {
        field: candidate.field,
        label: SCAN_FIELD_LABELS[candidate.field],
        value: candidate.value,
        sourceUrl: candidate.sourceUrl,
      };
    case 'social_link':
      return { provider: candidate.provider, url: candidate.url, sourceUrl: candidate.sourceUrl };
    case 'product':
      return { ...candidate.product, sourceUrl: candidate.sourceUrl };
  }
}

const KIND_ORDER = { business_profile: 0, profile_field: 1, social_link: 2, product: 3 } as const;
const REGISTRY_ORDER = new Map(PROFILE_FIELDS.map((f, index) => [f.key, index]));
const FIELD_ORDER = new Map(SCAN_PROFILE_FIELDS.map((field, index) => [field, index]));

function orderCandidates(candidates: ScanCandidate[]): ScanCandidate[] {
  return [...candidates].sort((a, b) => {
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.kind === 'business_profile' && b.kind === 'business_profile') {
      return (FIELD_ORDER.get(a.field) ?? 0) - (FIELD_ORDER.get(b.field) ?? 0);
    }
    if (a.kind === 'profile_field' && b.kind === 'profile_field') {
      return (REGISTRY_ORDER.get(a.key) ?? 0) - (REGISTRY_ORDER.get(b.key) ?? 0);
    }
    return 0;
  });
}

function stageOf(scan: WebsiteScan): ScanStage {
  if (scan.status !== 'queued' && scan.status !== 'running') return 'done';
  const config = scan.config as { stage?: string } | null;
  return config?.stage === 'understanding' ? 'understanding' : 'reading';
}

function aiOf(scan: WebsiteScan): ScanState['ai'] {
  const stored = (scan.completeness as { ai?: Partial<AiRunSummary> } | null)?.ai;
  const status: AiStatus = stored?.status ?? 'skipped';
  return { status, message: stored?.message ?? null, suggestions: stored?.suggestions ?? 0 };
}
