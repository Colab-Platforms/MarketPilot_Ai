import { LlmError, type LlmPort, type LlmUsage, type WebSearchEngine } from '@/infra/llm-providers';
import {
  COMPETITOR_PROMPT_VERSION,
  RANK_SYSTEM_PROMPT,
  buildRankPrompt,
  type CompetitorPromptInput,
} from './competitor-prompt';
import { COMPETITOR_ANSWER_SCHEMA, COMPETITOR_SCHEMA_NAME } from './competitor-schema';
import { planQueries } from './plan-queries';
import { recallBrands } from './recall-brands';
import { describeCandidates, mergeRecalled, searchBrands } from './search-brands';
import { domainOf, verifyCompetitors, type AiCompetitor } from './verify-competitors';

const MAX_CANDIDATES = 25;

export interface CompetitorDiscoveryInput extends CompetitorPromptInput {
  knownDomains: string[];
}

export interface CompetitorModels {
  // Writes the search queries; cheap.
  plan: string;
  // Reads each search's results; runs once per query.
  search: string;
  // Chooses and describes the final competitors.
  rank: string;
  engine: WebSearchEngine;
}

export interface CompetitorDiscoveryResult {
  competitors: AiCompetitor[];
  queries: string[];
  candidatesFound: number;
  usage: LlmUsage;
  promptVersion: string;
}

function total(usages: LlmUsage[], model: string): LlmUsage {
  return usages.reduce<LlmUsage>(
    (sum, u) => ({
      model,
      promptTokens: sum.promptTokens + u.promptTokens,
      completionTokens: sum.completionTokens + u.completionTokens,
      costUsd: u.costUsd === null ? sum.costUsd : (sum.costUsd ?? 0) + u.costUsd,
    }),
    { model, promptTokens: 0, completionTokens: 0, costUsd: null },
  );
}

// Plan queries and search each one, recall the market's leading brands alongside, then rank
// the merged candidates (ADR 0007). Only public business details go in.
export async function discoverCompetitors(
  llm: LlmPort,
  models: CompetitorModels,
  input: CompetitorDiscoveryInput,
): Promise<CompetitorDiscoveryResult> {
  const about = `${input.brandName} (${[input.subcategory ?? input.category, input.market.area].filter(Boolean).join(', ')})`;
  const [{ plan, search }, recall] = await Promise.all([
    planQueries(llm, models.plan, input).then(async (plan) => ({
      plan,
      search: await searchBrands(llm, models.search, models.engine, plan.queries, about),

      
    })),
    recallBrands(llm, models.rank, input),
  ]);
  if (search.failed === plan.queries.length) throw new LlmError('upstream', 'Every competitor search failed');

  const exclude = {
    ownDomain: input.websiteUrl ? domainOf(input.websiteUrl) : null,
    knownDomains: input.knownDomains,
  };
  const candidates = mergeRecalled(search.candidates, recall.brands)
    .filter((c) => c.domain !== exclude.ownDomain && !exclude.knownDomains.includes(c.domain))
    .slice(0, MAX_CANDIDATES);
  const recalledDomains = candidates.filter((c) => c.known).map((c) => c.domain);
  const usages = [plan.usage, recall.usage, ...search.usages].filter((u): u is LlmUsage => u !== null);
  if (candidates.length === 0) {
    return { competitors: [], queries: plan.queries, candidatesFound: 0, usage: total(usages, models.rank), promptVersion: COMPETITOR_PROMPT_VERSION };
  }

  const ranked = await llm.generateStructured({
    task: 'competitors.rank',
    model: models.rank,
    system: RANK_SYSTEM_PROMPT,
    user: buildRankPrompt(input, describeCandidates(candidates)),
    schemaName: COMPETITOR_SCHEMA_NAME,
    jsonSchema: COMPETITOR_ANSWER_SCHEMA,
    maxOutputTokens: 3_000,
    timeoutMs: 90_000,
  });
  // Grounded against every URL the searches returned, so a ranked pick must still be a real result.
  const competitors = verifyCompetitors(ranked.data, search.sources, exclude, recalledDomains);
  return {
    competitors,
    queries: plan.queries,
    candidatesFound: candidates.length,
    usage: total([...usages, ranked.usage], models.rank),
    promptVersion: COMPETITOR_PROMPT_VERSION,
  };
}
