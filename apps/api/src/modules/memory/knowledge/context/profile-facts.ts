import type { ProfileFieldState, ProfileResponse } from '@marketpilot/contracts';
import type { ContextFact } from './assemble';

// Values a task may rely on: stated by the owner, read from their site, or approved.
const CONFIRMED = new Set(['owner', 'website', 'ai', 'connected']);

export type ProfileFields = ReadonlyMap<string, ProfileFieldState>;

export function fieldsOf(profile: ProfileResponse): ProfileFields {
  return new Map(profile.sections.flatMap((s) => s.fields).map((f) => [f.key, f]));
}

function confirmedField(fields: ProfileFields, key: string): ProfileFieldState | null {
  const field = fields.get(key);
  return field && CONFIRMED.has(field.status) && field.value !== null ? field : null;
}

// Confirmed fields as label and readable value, in the order of `keys`.
export function confirmedFacts(fields: ProfileFields, keys: readonly string[]): ContextFact[] {
  return keys.flatMap((key) => {
    const field = confirmedField(fields, key);
    if (!field) return [];
    const label = (raw: string) => field.options?.find((o) => o.value === raw)?.label ?? raw;
    const value = Array.isArray(field.value)
      ? field.value.map(label).join(', ')
      : typeof field.value === 'boolean'
        ? field.value ? 'Yes' : 'No'
        : label(String(field.value));
    return value.trim() ? [{ key, label: field.label, value }] : [];
  });
}

// A confirmed single-value field (url, select, text) as its raw string.
export function confirmedText(fields: ProfileFields, key: string): string | null {
  const value = confirmedField(fields, key)?.value;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// A confirmed list field (tags, images) as its raw strings.
export function confirmedList(fields: ProfileFields, key: string): string[] {
  const value = confirmedField(fields, key)?.value;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}
