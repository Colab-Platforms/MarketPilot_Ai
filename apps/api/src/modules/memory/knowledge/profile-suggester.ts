import { Injectable, Logger } from '@nestjs/common';
import type { AccountType, AiStatus } from '@marketpilot/contracts';
import { AiService, type AiProduct, type AiSuggestion, type EvidencePage } from '@/modules/ai';
import { LlmError, type LlmFailure } from '@/infra/llm-providers';
import type { ScannedPage } from './website-scanner';

export interface AiRunSummary {
  status: AiStatus;
  // Plain language, shown to the owner only when the AI step did not run.
  message: string | null;
  suggestions: number;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  groupsFailed: number;
  truncated: boolean;
  promptVersion: string | null;
}

export interface AiRun {
  drafts: AiSuggestion[];
  // Products read from page text, only when the crawler found no structured catalogue.
  products: AiProduct[];
  summary: AiRunSummary;
}

const base = (status: AiStatus, message: string | null = null): AiRunSummary => ({
  status,
  message,
  suggestions: 0,
  model: null,
  promptTokens: 0,
  completionTokens: 0,
  costUsd: null,
  groupsFailed: 0,
  truncated: false,
  promptVersion: null,
});

export const AI_SKIPPED: AiRun = { drafts: [], products: [], summary: base('skipped') };

// Owners see one calm sentence; the real reason goes to the server log.
const FAILURE_MESSAGES: Record<LlmFailure, string> = {
  unavailable: 'AI suggestions are not set up yet.',
  auth: 'AI suggestions are unavailable right now.',
  insufficient_credits: 'AI suggestions are unavailable right now.',
  no_provider: 'AI suggestions are unavailable right now.',
  rate_limited: 'AI suggestions are busy. Try reading your website again in a minute.',
  timeout: 'AI suggestions took too long. Try reading your website again.',
  invalid_output: 'AI suggestions did not come back in a usable form. Try reading your website again.',
  cancelled: 'AI suggestions were stopped. Try reading your website again.',
  upstream: 'AI suggestions are unavailable right now.',
};

function toEvidence(page: ScannedPage): EvidencePage {
  const { parsed } = page;
  return {
    url: parsed.url,
    pageType: page.pageType,
    title: parsed.title,
    description: parsed.description,
    structured: parsed.jsonLd.length > 0 ? JSON.stringify(parsed.jsonLd) : '',
    text: parsed.footerText ? `${parsed.text}\n\nSite footer: ${parsed.footerText}` : parsed.text,
    images: parsed.images,
  };
}

@Injectable()
export class ProfileSuggester {
  private readonly logger = new Logger(ProfileSuggester.name);

  constructor(private readonly ai: AiService) {}

  async suggest(input: {
    pages: ScannedPage[];
    brandName: string;
    accountType: AccountType;
    category: string | null;
    city: string | null;
    skipKeys: ReadonlySet<string>;
    readProducts: boolean;
  }): Promise<AiRun> {
    if (!this.ai.available) {
      return { drafts: [], products: [], summary: base('unavailable', FAILURE_MESSAGES.unavailable) };
    }

    const evidence = input.pages.map(toEvidence);
    // A failed product read never costs the owner the profile suggestions, and the reverse.
    const productsPromise = input.readProducts
      ? this.ai.suggestProducts({ pages: evidence, brandName: input.brandName }).catch((error: unknown) => {
          this.logger.warn(`Product reading failed: ${error instanceof Error ? error.message : 'unknown'}`);
          return null;
        })
      : Promise.resolve(null);

    try {
      const [result, productResult] = await Promise.all([
        this.ai.suggestProfile({
          pages: evidence,
          brandName: input.brandName,
          accountType: input.accountType,
          category: input.category,
          city: input.city,
          skipKeys: input.skipKeys,
        }),
        productsPromise,
      ]);
      const usage = [...result.usage, ...(productResult ? [productResult.usage] : [])];
      return {
        drafts: result.suggestions,
        products: productResult?.products ?? [],
        summary: {
          status: 'ok',
          message: result.groupsFailed > 0 ? 'Some AI suggestions are missing. Read your website again to retry.' : null,
          suggestions: result.suggestions.length + (productResult?.products.length ?? 0),
          model: usage[0]?.model ?? null,
          promptTokens: usage.reduce((n, u) => n + u.promptTokens, 0),
          completionTokens: usage.reduce((n, u) => n + u.completionTokens, 0),
          costUsd: usage.some((u) => u.costUsd !== null) ? usage.reduce((n, u) => n + (u.costUsd ?? 0), 0) : null,
          groupsFailed: result.groupsFailed,
          truncated: result.truncated,
          promptVersion: result.promptVersion,
        },
      };
    } catch (error) {
      const reason: LlmFailure = error instanceof LlmError ? error.reason : 'upstream';
      this.logger.warn(`AI suggestions failed (${reason}): ${error instanceof Error ? error.message : 'unknown'}`);
      return { drafts: [], products: (await productsPromise)?.products ?? [], summary: base('failed', FAILURE_MESSAGES[reason]) };
    }
  }
}
