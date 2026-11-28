import type { ProfileFieldState, ScanCandidate } from '@marketpilot/contracts';
import { formatRupees, type Draft } from '@/features/fields/field-draft';

type ProductCandidate = Extract<ScanCandidate, { kind: 'product' }>;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function priceOf(product: ProductCandidate): string | null {
  if (product.priceMinor === undefined) return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: product.currency ?? 'INR',
      maximumFractionDigits: 0,
    }).format(product.priceMinor / 100);
  } catch {
    return `${product.priceMinor / 100} ${product.currency ?? ''}`.trim();
  }
}

// How a value reads when the row is not being edited: a sentence, or a set of chips.
export type Shown =
  | { kind: 'text'; text: string }
  | { kind: 'chips'; chips: string[] }
  | { kind: 'colours'; colours: string[] }
  | { kind: 'empty' };

const labelFor = (field: ProfileFieldState, value: string) =>
  field.options?.find((o) => o.value === value)?.label ?? value;

export function showDraft(field: ProfileFieldState, draft: Draft): Shown {
  if (Array.isArray(draft)) {
    const chips = draft.map((v) => labelFor(field, v));
    return chips.length > 0 ? { kind: 'chips', chips } : { kind: 'empty' };
  }
  const text = draft.trim();
  if (text === '') return { kind: 'empty' };
  switch (field.kind) {
    case 'tags': {
      const chips = text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
      return { kind: 'chips', chips };
    }
    case 'select':
      return { kind: 'text', text: labelFor(field, text) };
    case 'yesno':
      return { kind: 'text', text: text === 'yes' ? 'Yes' : 'No' };
    case 'money': {
      const n = Number(text.replace(/,/g, ''));
      return { kind: 'text', text: Number.isFinite(n) ? formatRupees(n) : text };
    }
    default:
      return { kind: 'text', text };
  }
}

export function showText(value: string): Shown {
  return value.trim() === '' ? { kind: 'empty' } : { kind: 'text', text: value };
}

// Only values that are plainly a colour are painted; a name like "maroon" is shown as text.
const COLOUR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;
export const isPaintable = (value: string) => COLOUR_PATTERN.test(value.trim());

export function asColours(shown: Shown): Shown {
  return shown.kind === 'chips' ? { kind: 'colours', colours: shown.chips } : shown;
}
