import { Prisma } from '@prisma/client';
import {
  fieldByKey,
  fieldsFor,
  isEditable,
  parseFieldValue,
  type AccountType,
  type FieldValue,
  type PolicyKindName,
  type SocialProviderName,
} from '@marketpilot/contracts';

export interface WritePlan {
  brand: { name?: string; websiteUrl?: string | null; scale?: string; languages?: string[] };
  // Ready for Prisma: cleared values are already translated to what each column needs.
  columns: Record<string, unknown>;
  attributes: { set: Record<string, unknown>; remove: string[] };
  social: { provider: SocialProviderName; url: string | null }[];
  policies: { kind: PolicyKindName; content: string | null }[];
  // Fields whose provenance is rewritten (set) or dropped (clear).
  stamped: string[];
  cleared: string[];
  categoryChanged: boolean;
  category: string | null;
}

export type PlanResult = { ok: true; plan: WritePlan } | { ok: false; errors: Record<string, string> };

const ARRAY_KINDS = new Set(['tags', 'multiselect']);

function columnWrite(column: string, kind: string, value: FieldValue): unknown {
  if (column === 'operatingHours') return value === null ? Prisma.DbNull : { text: value };
  if (column === 'branches') return value ?? [];
  if (column === 'country') return value ?? 'IN';
  if (column === 'monthlyBudgetMinor') return typeof value === 'number' ? value * 100 : null;
  if (ARRAY_KINDS.has(kind)) return value ?? [];
  return value;
}

// Validates the changed values against the registry and works out exactly what to
// write. Pure, so the rules are testable without a database.
export function planProfileWrites(
  input: { track: AccountType; category: string | null; languages: string[] },
  values: Record<string, unknown>,
): PlanResult {
  // A category chosen in this same save already decides which pack applies.
  const effectiveCategory = typeof values.category === 'string' ? values.category : input.category;
  const allowed = new Map(fieldsFor(input.track, effectiveCategory).map((f) => [f.key, f]));
  const errors: Record<string, string> = {};
  const plan: WritePlan = {
    brand: {},
    columns: {},
    attributes: { set: {}, remove: [] },
    social: [],
    policies: [],
    stamped: [],
    cleared: [],
    categoryChanged: false,
    category: input.category,
  };
  let primaryLanguage: string | undefined;
  let secondaryLanguages: string[] | undefined;

  for (const [key, raw] of Object.entries(values)) {
    const def = allowed.get(key) ?? undefined;
    if (!def || !fieldByKey(key)) {
      errors[key] = 'This field does not exist';
      continue;
    }
    if (!isEditable(def)) {
      errors[key] = 'This field cannot be edited here';
      continue;
    }
    const parsed = parseFieldValue(def, raw);
    if (!parsed.ok) {
      errors[key] = parsed.message;
      continue;
    }
    const { value } = parsed;
    (value === null ? plan.cleared : plan.stamped).push(key);
    const s = def.storage;

    if (s.type === 'brand') {
      if (s.column === 'name') plan.brand.name = value as string;
      if (s.column === 'websiteUrl') plan.brand.websiteUrl = value as string | null;
      if (s.column === 'scale') plan.brand.scale = value === null ? 'small' : (value as string);
      if (s.column === 'language') primaryLanguage = value as string | undefined;
      if (s.column === 'secondaryLanguages') secondaryLanguages = (value as string[] | null) ?? [];
    } else if (s.type === 'column') {
      plan.columns[s.column] = columnWrite(s.column, def.kind, value);
      if (s.column === 'category') {
        plan.categoryChanged = true;
        plan.category = value as string | null;
      }
    } else if (s.type === 'attribute') {
      if (value === null) plan.attributes.remove.push(s.key);
      else plan.attributes.set[s.key] = def.kind === 'money' ? (value as number) * 100 : value;
    } else if (s.type === 'social') {
      plan.social.push({ provider: s.provider, url: value as string | null });
    } else if (s.type === 'policy') {
      plan.policies.push({ kind: s.kind, content: value as string | null });
    }
  }

  if (primaryLanguage !== undefined || secondaryLanguages !== undefined) {
    const primary = primaryLanguage ?? input.languages[0] ?? 'en';
    const rest = secondaryLanguages ?? input.languages.slice(1);
    plan.brand.languages = [primary, ...new Set(rest.filter((l) => l !== primary))];
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, plan };
}
