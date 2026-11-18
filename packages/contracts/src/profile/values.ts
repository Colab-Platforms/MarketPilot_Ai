import { z } from 'zod';
import type { ProfileFieldDef } from './types';

// Values travel as plain JSON: text, a list of text, a whole number (rupees for
// money), or yes/no. `null` means "no value".
export type FieldValue = string | string[] | number | boolean | null;

export const fieldValueSchema = z.union([z.string(), z.array(z.string()), z.number(), z.boolean(), z.null()]);

export type ParsedValue = { ok: true; value: FieldValue } | { ok: false; message: string };

const MAX_TAGS = 40;
export const MAX_FIELD_IMAGES = 9;
const MAX_TAG_LENGTH = 100;
const DEFAULT_TEXT = 200;
const DEFAULT_TEXTAREA = 1500;

function toUrl(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

const isEmpty = (raw: unknown) =>
  raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0);

// Validates and normalises one value against its field definition. Used by the API
// (the real check) and by the web form (to catch mistakes before sending).
export function parseFieldValue(def: ProfileFieldDef, raw: unknown): ParsedValue {
  if (isEmpty(raw)) {
    return def.required ? { ok: false, message: 'This is required' } : { ok: true, value: null };
  }

  switch (def.kind) {
    case 'text':
    case 'textarea':
    case 'hours': {
      if (typeof raw !== 'string') return { ok: false, message: 'Enter text' };
      const text = raw.trim();
      const max = def.maxLength ?? (def.kind === 'textarea' ? DEFAULT_TEXTAREA : DEFAULT_TEXT);
      if (text.length > max) return { ok: false, message: `Use at most ${max} characters` };
      return { ok: true, value: text };
    }
    case 'select': {
      const allowed = (def.options ?? []).map((o) => o.value);
      return typeof raw === 'string' && allowed.includes(raw)
        ? { ok: true, value: raw }
        : { ok: false, message: 'Choose one of the options' };
    }
    case 'multiselect': {
      const allowed = (def.options ?? []).map((o) => o.value);
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string' || !allowed.includes(v))) {
        return { ok: false, message: 'Choose from the options shown' };
      }
      return { ok: true, value: [...new Set(raw as string[])] };
    }
    case 'tags': {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) return { ok: false, message: 'Enter a list' };
      const tags = [...new Set((raw as string[]).map((t) => t.trim()).filter(Boolean))];
      if (tags.length > MAX_TAGS) return { ok: false, message: `Use at most ${MAX_TAGS} items` };
      if (tags.some((t) => t.length > MAX_TAG_LENGTH)) return { ok: false, message: 'One of the items is too long' };
      return { ok: true, value: tags };
    }
    case 'images': {
      const valid = (v: unknown) => typeof v === 'string' && v.length <= 500 && /^https:\/\/[^\s]+$/.test(v);
      if (!Array.isArray(raw) || !raw.every(valid)) return { ok: false, message: 'Upload images here' };
      const urls = [...new Set(raw as string[])];
      if (urls.length > MAX_FIELD_IMAGES) return { ok: false, message: `Add at most ${MAX_FIELD_IMAGES} images` };
      return { ok: true, value: urls };
    }
    case 'url': {
      const url = typeof raw === 'string' ? toUrl(raw.trim()) : null;
      return url && url.length <= 500 ? { ok: true, value: url } : { ok: false, message: 'Enter a valid web address' };
    }
    case 'email': {
      const parsed = z.string().trim().toLowerCase().email().max(120).safeParse(raw);
      return parsed.success ? { ok: true, value: parsed.data } : { ok: false, message: 'Enter a valid email address' };
    }
    case 'phone': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      const digits = text.replace(/\D/g, '');
      return /^[+\d][\d\s()-]*$/.test(text) && digits.length >= 7 && digits.length <= 15
        ? { ok: true, value: text }
        : { ok: false, message: 'Enter a valid phone number' };
    }
    case 'number':
    case 'money': {
      const n = typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : raw;
      return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1_000_000_000
        ? { ok: true, value: n }
        : { ok: false, message: 'Enter a whole number' };
    }
    case 'year': {
      const n = typeof raw === 'string' ? Number(raw) : raw;
      const now = new Date().getFullYear();
      return typeof n === 'number' && Number.isInteger(n) && n >= 1800 && n <= now
        ? { ok: true, value: n }
        : { ok: false, message: `Enter a year between 1800 and ${now}` };
    }
    case 'yesno':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, message: 'Choose yes or no' };
    case 'date': {
      const valid = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw));
      return valid ? { ok: true, value: raw as string } : { ok: false, message: 'Enter a valid date' };
    }
  }
}
