import {
  AI_GROUPS,
  aiGroupOf,
  aiModeOf,
  fieldsFor,
  type AccountType,
  type AiGroup,
  type ProfileFieldDef,
} from '@marketpilot/contracts';
import { LlmError, type LlmPort, type LlmUsage } from '@/infra/llm-providers';
import { SUPPORTED_KINDS, buildAnswerSchema } from './answer-schema';
import { packEvidence, type EvidencePage } from './evidence';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import { verifyAnswer, type AiSuggestion, type DropReason } from './verify';

export interface ProfileExtractInput {
  pages: EvidencePage[];
  brandName: string;
  accountType: AccountType;
  category: string | null;
  city: string | null;
  // Fields not to ask for: the owner already stated them, or the scan already found them.
  skipKeys: ReadonlySet<string>;
}

export interface ProfileExtractResult {
  suggestions: AiSuggestion[];
  usage: LlmUsage[];
  promptVersion: string;
  groupsTotal: number;
  groupsFailed: number;
  dropped: Partial<Record<DropReason, number>>;
  truncated: boolean;
}

export const MAX_OUTPUT_TOKENS = 8_000;
const SCHEMA_NAME = 'profile_fields';

function askable(input: ProfileExtractInput): { def: ProfileFieldDef; mode: string; group: AiGroup }[] {
  return fieldsFor(input.accountType, input.category).flatMap((def) => {
    const mode = aiModeOf(def);
    if (!mode || !SUPPORTED_KINDS.has(def.kind) || input.skipKeys.has(def.key)) return [];
    return [{ def, mode, group: aiGroupOf(def) }];
  });
}

// One structured request per group of fields, run in parallel. A group that fails
// does not lose the others; only when every group fails does the caller hear about it.
export async function extractProfileFields(
  llm: LlmPort,
  model: string,
  input: ProfileExtractInput,
): Promise<ProfileExtractResult> {
  const fields = askable(input);
  const pack = packEvidence(input.pages);
  const result: ProfileExtractResult = {
    suggestions: [],
    usage: [],
    promptVersion: PROMPT_VERSION,
    groupsTotal: 0,
    groupsFailed: 0,
    dropped: {},
    truncated: pack.truncated,
  };
  if (pack.pages.length === 0) return result;

  const jobs = AI_GROUPS.map((group) => ({ group, fields: fields.filter((f) => f.group === group) })).filter(
    (job) => job.fields.length > 0,
  );
  result.groupsTotal = jobs.length;

  const settled = await Promise.allSettled(
    jobs.map(async (job) => {
      const response = await llm.generateStructured({
        task: `profile.extract.${job.group}`,
        model,
        system: SYSTEM_PROMPT,
        user: buildUserPrompt({
          brandName: input.brandName,
          accountType: input.accountType,
          category: input.category,
          city: input.city,
          fields: job.fields,
          pack,
        }),
        schemaName: SCHEMA_NAME,
        jsonSchema: buildAnswerSchema(job.fields),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      return { response, report: verifyAnswer(response.data, job.fields, pack) };
    }),
  );

  const failures: unknown[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      result.groupsFailed += 1;
      failures.push(outcome.reason);
      continue;
    }
    result.usage.push(outcome.value.response.usage);
    result.suggestions.push(...outcome.value.report.suggestions);
    for (const [reason, count] of Object.entries(outcome.value.report.dropped)) {
      const key = reason as DropReason;
      result.dropped[key] = (result.dropped[key] ?? 0) + count;
    }
  }
  if (result.groupsFailed === result.groupsTotal && result.groupsTotal > 0) {
    throw failures[0] instanceof LlmError ? failures[0] : new LlmError('upstream', 'The AI step failed');
  }
  return result;
}
