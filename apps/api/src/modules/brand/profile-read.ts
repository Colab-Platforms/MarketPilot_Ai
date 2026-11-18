import {
  SECTIONS,
  canSkipSection,
  fieldsFor,
  isEditable,
  type AccountType,
  type FieldStatus,
  type FieldValue,
  type ProfileFieldDef,
  type ProfileFieldState,
  type ProfileResponse,
} from '@marketpilot/contracts';

export interface ProfileData {
  accountType: AccountType;
  brand: { id: string; name: string; websiteUrl: string | null; scale: string; languages: string[] };
  profile: Record<string, unknown> | null;
  socials: SocialRow[];
  policies: PolicyRow[];
  products: ProductRow[];
}

export interface SocialRow {
  provider: string;
  profileUrl: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  createdAt: Date;
  verifiedAt: Date | null;
}
export interface PolicyRow {
  kind: string;
  content: string;
  sourceType: string;
  sourceUrl: string | null;
  updatedAt: Date;
}
export interface ProductRow {
  name: string;
  category: string | null;
  description: string | null;
  imageUrls: string[];
  priceMinor: number | null;
  currency: string;
  availability: string;
}

interface Read {
  value: FieldValue;
  display: string | null;
  status: FieldStatus;
  sourceUrl: string | null;
  updatedAt: string | null;
}

type Json = Record<string, unknown>;

const STATUS_BY_SOURCE: Record<string, FieldStatus> = {
  crawled: 'website',
  user_stated: 'owner',
  ai_inferred: 'ai',
  integration: 'connected',
};

const isBlank = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const asJson = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});

function rupees(minor: unknown): number | null {
  return typeof minor === 'number' ? Math.floor(minor / 100) : null;
}

// The stored shape of a profile column, as the plain value the form edits.
function columnValue(column: string, raw: unknown): FieldValue {
  if (isBlank(raw)) return null;
  if (column === 'operatingHours') return typeof asJson(raw).text === 'string' ? (asJson(raw).text as string) : null;
  if (column === 'branches') {
    const list = (Array.isArray(raw) ? raw : []).map((b) => (typeof b === 'string' ? b : String(asJson(b).name ?? '')));
    return list.filter(Boolean);
  }
  if (column === 'monthlyBudgetMinor') return rupees(raw);
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  return String(raw);
}

function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
  } catch {
    return `${Math.floor(minor / 100)} ${currency}`;
  }
}

function summarise(of: string, products: ProductRow[]): string | null {
  if (products.length === 0) return null;
  const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];
  switch (of) {
    case 'names': {
      const names = products.slice(0, 3).map((p) => p.name);
      return `${products.length} ${products.length === 1 ? 'product' : 'products'}: ${names.join(', ')}${products.length > 3 ? ', and more' : ''}`;
    }
    case 'categories': {
      const categories = distinct(products.map((p) => p.category));
      return categories.length > 0 ? categories.slice(0, 6).join(', ') : null;
    }
    case 'descriptions': {
      const described = products.filter((p) => p.description).length;
      return `${described} of ${products.length} have a description`;
    }
    case 'images': {
      const withImages = products.filter((p) => p.imageUrls.length > 0).length;
      return `${withImages} of ${products.length} have an image`;
    }
    case 'pricing': {
      const priced = products.filter((p) => p.priceMinor !== null);
      if (priced.length === 0) return null;
      const prices = priced.map((p) => p.priceMinor as number);
      const currency = priced[0]!.currency;
      const [low, high] = [Math.min(...prices), Math.max(...prices)];
      return low === high ? formatMoney(low, currency) : `${formatMoney(low, currency)} to ${formatMoney(high, currency)}`;
    }
    case 'availability': {
      const inStock = products.filter((p) => p.availability === 'in_stock').length;
      return `${inStock} of ${products.length} in stock`;
    }
    default:
      return null;
  }
}

function read(def: ProfileFieldDef, data: ProfileData, attrs: Json, prov: Json): Read {
  const empty: Read = { value: null, display: null, status: 'missing', sourceUrl: null, updatedAt: null };
  const stamp = asJson(prov[def.key]);
  const fromStamp = (value: FieldValue): Read => {
    if (isBlank(value)) return empty;
    const source = typeof stamp.sourceType === 'string' ? stamp.sourceType : 'user_stated';
    return {
      value,
      display: null,
      status: STATUS_BY_SOURCE[source] ?? 'owner',
      sourceUrl: typeof stamp.sourceUrl === 'string' ? stamp.sourceUrl : null,
      updatedAt: typeof stamp.verifiedAt === 'string' ? stamp.verifiedAt : null,
    };
  };
  const s = def.storage;

  switch (s.type) {
    case 'brand': {
      const { brand } = data;
      const value: FieldValue =
        s.column === 'name' ? brand.name
        : s.column === 'websiteUrl' ? brand.websiteUrl
        : s.column === 'scale' ? brand.scale
        : s.column === 'language' ? (brand.languages[0] ?? null)
        : brand.languages.slice(1);
      return fromStamp(value);
    }
    case 'column':
      return fromStamp(columnValue(s.column, data.profile?.[s.column]));
    case 'attribute': {
      const raw = attrs[s.key];
      return fromStamp(def.kind === 'money' ? rupees(raw) : isBlank(raw) ? null : (raw as FieldValue));
    }
    case 'social': {
      const rows = data.socials
        .filter((r) => r.provider === s.provider)
        .sort((a, b) => Number(b.status === 'verified') - Number(a.status === 'verified') || +a.createdAt - +b.createdAt);
      const row = rows[0];
      if (!row) return empty;
      return {
        value: row.profileUrl,
        display: null,
        status: STATUS_BY_SOURCE[row.sourceType] ?? 'owner',
        sourceUrl: row.sourceUrl,
        updatedAt: row.verifiedAt?.toISOString() ?? null,
      };
    }
    case 'policy': {
      const row = data.policies.find((r) => r.kind === s.kind);
      if (!row) return empty;
      return {
        value: row.content,
        display: null,
        status: STATUS_BY_SOURCE[row.sourceType] ?? 'owner',
        sourceUrl: row.sourceUrl,
        updatedAt: row.updatedAt.toISOString(),
      };
    }
    case 'summary': {
      const display = summarise(s.of, data.products);
      return { ...empty, display, status: display ? 'derived' : 'missing' };
    }
    case 'connection':
      return { ...empty, status: 'needs_connection' };
    case 'alias':
      return empty;
  }
}

export function buildProfileResponse(data: ProfileData): ProfileResponse {
  const attrs = asJson(data.profile?.attributes);
  const prov = asJson(data.profile?.provenance);
  const category = typeof data.profile?.category === 'string' ? data.profile.category : null;
  const defs = fieldsFor(data.accountType, category);
  const reads = new Map(defs.map((d) => [d.key, read(d, data, attrs, prov)]));
  const skippedIds = new Set(Array.isArray(data.profile?.skippedSections) ? (data.profile.skippedSections as string[]) : []);

  const sections = SECTIONS.map((section) => {
    const entries = defs
      .filter((d) => d.section === section.id)
      .map((d) => {
        const r = d.storage.type === 'alias' ? (reads.get(d.storage.of) ?? reads.get(d.key)!) : reads.get(d.key)!;
        const state: ProfileFieldState = {
          id: d.id,
          key: d.key,
          label: d.label,
          kind: d.kind,
          ...(d.helper && { helper: d.helper }),
          ...(d.options && { options: d.options.map((o) => ({ value: o.value, label: o.label })) }),
          ...(d.maxLength && { maxLength: d.maxLength }),
          ...(d.required && { required: true }),
          ...(d.hidden && { hidden: true }),
          editable: isEditable(d),
          sources: [...d.sources],
          value: r.value,
          display: d.storage.type === 'alias' ? (typeof r.value === 'string' ? r.value : null) : r.display,
          status: d.storage.type === 'alias' ? 'derived' : r.status,
          sourceUrl: r.sourceUrl,
          updatedAt: r.updatedAt,
        };
        return { def: d, state };
      });
    // Fields that wait on a connected account, repeats of another field, and fields the owner
    // never sees do not count.
    const counted = entries.filter(
      (e) => e.def.storage.type !== 'connection' && e.def.storage.type !== 'alias' && !e.def.hidden,
    );
    const filled = counted.filter((e) => e.state.status !== 'missing').length;
    const canSkip = canSkipSection(section.id);
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      filled,
      total: counted.length,
      skipped: canSkip && skippedIds.has(section.id),
      canSkip,
      fields: entries.map((e) => e.state),
    };
  }).filter((section) => section.fields.length > 0);
  const counting = sections.filter((s) => !s.skipped);

  return {
    brand: {
      id: data.brand.id,
      name: data.brand.name,
      websiteUrl: data.brand.websiteUrl,
      accountType: data.accountType,
      category,
    },
    // Sections switched off as not relevant do not count against the owner.
    completeness: {
      filled: counting.reduce((n, s) => n + s.filled, 0),
      total: counting.reduce((n, s) => n + s.total, 0),
    },
    sections,
  };
}
