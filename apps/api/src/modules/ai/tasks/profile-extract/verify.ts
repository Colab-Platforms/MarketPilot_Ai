import { parseFieldValue, type FieldValue, type ProfileFieldDef } from '@marketpilot/contracts';
import { answerEntrySchema, toProp } from './answer-schema';
import { normalizeForMatch, type EvidencePack } from './evidence';

export interface AiSuggestion {
  key: string;
  value: FieldValue;
  basis: 'stated' | 'inferred';
  evidence: string | null;
  sourceUrl: string | null;
}

export type DropReason =
  | 'missing'
  | 'none'
  | 'shape'
  | 'invalid'
  | 'suspicious'
  | 'inference_not_allowed'
  | 'no_evidence';

export interface VerifyReport {
  suggestions: AiSuggestion[];
  dropped: Partial<Record<DropReason, number>>;
}

const MIN_QUOTE = 8;
const MAX_EVIDENCE = 300;
// Text that reads like an instruction to the system, not a description of a business.
const SUSPICIOUS = /(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)|system prompt|you are (now )?an? (ai|assistant|language model)|as an ai\b/i;

const isEmpty = (value: unknown) => value === '' || (Array.isArray(value) && value.length === 0);

function findQuote(quote: string, pack: EvidencePack): string | null {
  const needle = normalizeForMatch(quote);
  if (needle.length < MIN_QUOTE) return null;
  for (const page of pack.pages) {
    const haystack = normalizeForMatch(`${page.title ?? ''} ${page.description ?? ''} ${page.structured} ${page.text}`);
    if (haystack.includes(needle)) return page.url;
  }
  return null;
}

// The model's answer is a claim, not a fact. Each field is dropped unless it passes
// the same validation as a manual edit and, when it says "stated", its quote
// really appears in the pages we gave it.
export function verifyAnswer(
  raw: unknown,
  fields: readonly { def: ProfileFieldDef; mode: string }[],
  pack: EvidencePack,
): VerifyReport {
  const suggestions: AiSuggestion[] = [];
  const dropped: VerifyReport['dropped'] = {};
  const drop = (reason: DropReason) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };
  const answer = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  for (const { def, mode } of fields) {
    const parsedEntry = answerEntrySchema.safeParse(answer[toProp(def.key)]);
    if (!parsedEntry.success) {
      drop(answer[toProp(def.key)] === undefined ? 'missing' : 'shape');
      continue;
    }
    const entry = parsedEntry.data;
    if (entry.basis === 'none' || isEmpty(entry.value)) {
      drop('none');
      continue;
    }

    const wantsList = def.kind === 'tags' || def.kind === 'multiselect';
    if (wantsList !== Array.isArray(entry.value)) {
      drop('shape');
      continue;
    }
    const parsed = parseFieldValue(def, entry.value);
    if (!parsed.ok || parsed.value === null) {
      drop('invalid');
      continue;
    }
    const strings = Array.isArray(parsed.value) ? parsed.value : [String(parsed.value)];
    if (strings.some((s) => SUSPICIOUS.test(s)) || SUSPICIOUS.test(entry.evidence)) {
      drop('suspicious');
      continue;
    }
    if (entry.basis === 'inferred' && mode !== 'inferred') {
      drop('inference_not_allowed');
      continue;
    }

    const sourceUrl = entry.evidence ? findQuote(entry.evidence, pack) : null;
    if (entry.basis === 'stated' && !sourceUrl) {
      drop('no_evidence');
      continue;
    }
    suggestions.push({
      key: def.key,
      value: parsed.value,
      basis: entry.basis,
      evidence: sourceUrl ? entry.evidence.trim().slice(0, MAX_EVIDENCE) : null,
      sourceUrl,
    });
  }
  return { suggestions, dropped };
}
