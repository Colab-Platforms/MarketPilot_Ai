import { fieldByKey, parseFieldValue, type ProfileFieldState } from '@marketpilot/contracts';

// What a form control holds while the owner is typing. Lists are typed as
// comma-separated text, numbers as text, yes/no as a choice.
export type Draft = string | string[];

const MONEY_FORMAT = new Intl.NumberFormat('en-IN');

// Kinds whose control edits the list itself, not comma-separated text.
const LIST_KINDS = new Set(['multiselect', 'images']);

export function toDraft(field: ProfileFieldState): Draft {
  const { value } = field;
  if (value === null) return LIST_KINDS.has(field.kind) ? [] : '';
  if (Array.isArray(value)) return LIST_KINDS.has(field.kind) ? value : value.join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

// Converts a draft to the value the API expects. Unparseable numbers stay as text so
// the validator can explain what is wrong.
export function fromDraft(field: ProfileFieldState, draft: Draft): unknown {
  if (Array.isArray(draft)) return draft;
  const text = draft.trim();
  switch (field.kind) {
    case 'tags':
      return text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
    case 'multiselect':
    case 'images':
      return [];
    case 'number':
    case 'year':
    case 'money': {
      if (text === '') return null;
      const n = Number(text.replace(/,/g, ''));
      return Number.isFinite(n) ? n : text;
    }
    case 'yesno':
      return text === 'yes' ? true : text === 'no' ? false : null;
    default:
      return text === '' ? null : text;
  }
}

const normalise = (v: unknown) => (Array.isArray(v) && v.length === 0 ? null : v);

export function isChanged(field: ProfileFieldState, draft: Draft): boolean {
  const next = normalise(fromDraft(field, draft)) ?? null;
  const current = normalise(field.value) ?? null;
  return JSON.stringify(next) !== JSON.stringify(current);
}

// Client-side check using the same rules as the server, so mistakes show up before saving.
export function validateDraft(field: ProfileFieldState, draft: Draft): string | null {
  const def = fieldByKey(field.key);
  if (!def) return null;
  const parsed = parseFieldValue(def, fromDraft(field, draft));
  return parsed.ok ? null : parsed.message;
}

export function formatRupees(amount: number): string {
  return `₹${MONEY_FORMAT.format(amount)}`;
}
