import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACK_NAMES, PROFILE_FIELDS, SECTIONS, fieldsFor, parseFieldValue } from '@marketpilot/contracts';

const brief = PROFILE_FIELDS.filter((f) => typeof f.id === 'number' && f.id <= 176);

describe('profile field registry', () => {
  it('covers every one of the 176 fields of the information checklist exactly once', () => {
    const ids = brief.map((f) => f.id as number).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 176 }, (_, i) => i + 1));
  });

  it('has unique keys, valid sections and options wherever a choice is offered', () => {
    const keys = PROFILE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    const sectionIds = new Set(SECTIONS.map((s) => s.id));
    for (const f of PROFILE_FIELDS) {
      expect(sectionIds.has(f.section)).toBe(true);
      if (f.kind === 'select' || f.kind === 'multiselect') expect(f.options?.length).toBeGreaterThan(1);
    }
  });

  it('keeps attribute keys from shadowing real profile columns', () => {
    const schema = readFileSync(join(__dirname, '../../../prisma/schema/brand.prisma'), 'utf8');
    const profileModel = /model BrandProfile \{([\s\S]*?)\n\}/.exec(schema)![1]!;
    const columns = new Set([...profileModel.matchAll(/^\s+(\w+)\s/gm)].map((m) => m[1]));
    for (const f of PROFILE_FIELDS) {
      if (f.storage.type === 'attribute') expect(columns.has(f.storage.key)).toBe(false);
      if (f.storage.type === 'column') expect(columns.has(f.storage.column)).toBe(true);
    }
  });

  it('shows only the pack for the brand category, and only fields for the account type', () => {
    const fashion = fieldsFor('business', 'fashion').filter((f) => f.section === 'specific');
    expect(fashion.length).toBeGreaterThan(0);
    expect(fashion.every((f) => f.pack === 'fashion')).toBe(true);
    expect(fieldsFor('business', 'services').some((f) => f.section === 'specific')).toBe(false);
    expect(fieldsFor('creator', null).some((f) => f.key === 'legalName')).toBe(false);
    expect(fieldsFor('business', null).some((f) => f.key === 'niche')).toBe(false);
    expect(PACK_NAMES).toContain('travel');
  });
});

describe('parseFieldValue', () => {
  const def = (key: string) => PROFILE_FIELDS.find((f) => f.key === key)!;

  it('normalises and validates by kind', () => {
    expect(parseFieldValue(def('contactEmail'), ' Hello@Shop.IN ')).toEqual({ ok: true, value: 'hello@shop.in' });
    expect(parseFieldValue(def('contactEmail'), 'nope').ok).toBe(false);
    expect(parseFieldValue(def('contactPhone'), '+91 98765 43210')).toEqual({ ok: true, value: '+91 98765 43210' });
    expect(parseFieldValue(def('contactPhone'), 'call me').ok).toBe(false);
    expect(parseFieldValue(def('yearEstablished'), '2011')).toEqual({ ok: true, value: 2011 });
    expect(parseFieldValue(def('yearEstablished'), 1500).ok).toBe(false);
    expect(parseFieldValue(def('monthlyBudgetMinor'), '5,000')).toEqual({ ok: true, value: 5000 });
    expect(parseFieldValue(def('brand.websiteUrl'), 'shop.in')).toEqual({ ok: true, value: 'https://shop.in/' });
    expect(parseFieldValue(def('brand.websiteUrl'), 'not a site').ok).toBe(false);
    expect(parseFieldValue(def('primaryObjective'), 'sales')).toEqual({ ok: true, value: 'sales' });
    expect(parseFieldValue(def('primaryObjective'), 'world domination').ok).toBe(false);
    expect(parseFieldValue(def('preferredChannels'), ['instagram', 'telegram']).ok).toBe(false);
    expect(parseFieldValue(def('hasPhysicalStore'), true)).toEqual({ ok: true, value: true });
    expect(parseFieldValue(def('campaignStartDate'), '2026-12-01')).toEqual({ ok: true, value: '2026-12-01' });
    expect(parseFieldValue(def('campaignStartDate'), '01/12/2026').ok).toBe(false);
  });

  it('trims and de-duplicates tags, and treats blank as clearing', () => {
    expect(parseFieldValue(def('serviceAreas'), [' Pune ', 'Pune', 'Mumbai', ''])).toEqual({
      ok: true,
      value: ['Pune', 'Mumbai'],
    });
    expect(parseFieldValue(def('tagline'), '')).toEqual({ ok: true, value: null });
    expect(parseFieldValue(def('serviceAreas'), [])).toEqual({ ok: true, value: null });
  });

  it('refuses to clear a required field and over-long text', () => {
    expect(parseFieldValue(def('brand.name'), '')).toEqual({ ok: false, message: 'This is required' });
    expect(parseFieldValue(def('description'), 'x'.repeat(601)).ok).toBe(false);
  });
});
