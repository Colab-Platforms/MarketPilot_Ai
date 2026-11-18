import type {
  BrandAudience,
  BrandCompetitor,
  BrandFaq,
  BrandPolicy,
  BrandProduct,
  BrandService,
} from '@prisma/client';
import type { FieldValue, ProfileFieldState, ProfileResponse } from '@marketpilot/contracts';

// One owner-approved fact or record, as the text that gets chunked and embedded.
export interface EntityDocument {
  entityType: string;
  entityId: string;
  title: string;
  text: string;
}

const lines = (...parts: (string | null | undefined | false)[]): string => parts.filter(Boolean).join('\n');
const list = (label: string, values: readonly string[]): string | false =>
  values.length > 0 && `${label}: ${values.join(', ')}`;

// Price and availability are left out on purpose: they change often, and an answer must read
// them from the record, never from an old vector hit. It also avoids re-embedding on every price edit.
export function productDocument(row: BrandProduct): EntityDocument {
  return {
    entityType: 'product',
    entityId: row.id,
    title: row.name,
    text: lines(
      `Product: ${row.name}`,
      row.category && `Category: ${row.category}`,
      row.description && `Description: ${row.description}`,
      list('Tags', row.tags),
    ),
  };
}

export function serviceDocument(row: BrandService): EntityDocument {
  return {
    entityType: 'service',
    entityId: row.id,
    title: row.name,
    text: lines(
      `Service: ${row.name}`,
      row.description && `Description: ${row.description}`,
      list('Benefits', row.benefits),
      row.durationMinutes != null && row.durationMinutes > 0 && `Duration: ${row.durationMinutes} minutes`,
      row.bookingProcess && `How to book: ${row.bookingProcess}`,
    ),
  };
}

export function policyDocument(row: BrandPolicy): EntityDocument {
  const kind = row.kind.replace(/_/g, ' ');
  return {
    entityType: 'policy',
    entityId: row.id,
    title: row.title ?? kind,
    text: lines(`Policy (${kind})${row.title ? `: ${row.title}` : ''}`, row.content),
  };
}

export function faqDocument(row: BrandFaq): EntityDocument {
  return {
    entityType: 'faq',
    entityId: row.id,
    title: row.question,
    text: lines(`Question: ${row.question}`, `Answer: ${row.answer}`),
  };
}

export function competitorDocument(row: BrandCompetitor): EntityDocument {
  return {
    entityType: 'competitor',
    entityId: row.id,
    title: row.name,
    text: lines(
      `Competitor: ${row.name}`,
      row.websiteUrl && `Website: ${row.websiteUrl}`,
      row.summary && `About: ${row.summary}`,
      row.whySimilar && `Why it competes: ${row.whySimilar}`,
      list('Sells', row.offerings),
      row.priceRange && `Price level: ${row.priceRange}`,
      row.positioning && `Positioning: ${row.positioning}`,
    ),
  };
}

export function audienceDocument(row: BrandAudience): EntityDocument {
  return {
    entityType: 'audience',
    entityId: row.id,
    title: row.name,
    text: lines(
      `Target audience (${row.kind}): ${row.name}`,
      row.description,
      row.ageRange && `Age: ${row.ageRange}`,
      list('Locations', row.locations),
      list('Interests', row.interests),
      list('Pain points', row.painPoints),
    ),
  };
}

// Only what the owner confirmed or approved is searchable. Catalogue summaries are
// derived from records indexed on their own, and connection fields are not text.
const INDEXED_STATUSES = new Set<ProfileFieldState['status']>(['owner', 'website', 'ai', 'connected']);
const SKIPPED_KINDS = new Set(['url', 'email', 'phone', 'images']);

function readable(field: ProfileFieldState, value: FieldValue): string | null {
  const label = (raw: string) => field.options?.find((option) => option.value === raw)?.label ?? raw;
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.map(label).join(', ') : null;
  const text = String(value).trim();
  return text ? label(text) : null;
}

// The brand profile (the 176-field checklist) becomes one searchable document per section,
// so a question about tone or goals finds that section's facts together.
export function profileDocuments(profile: ProfileResponse): EntityDocument[] {
  return profile.sections.flatMap((section) => {
    const facts = section.fields
      .filter((field) => INDEXED_STATUSES.has(field.status) && !SKIPPED_KINDS.has(field.kind))
      .flatMap((field) => {
        const value = readable(field, field.value);
        return value ? [`${field.label}: ${value}`] : [];
      });
    if (facts.length === 0) return [];
    return [
      {
        entityType: `profile:${section.id}`,
        entityId: profile.brand.id,
        title: section.title,
        text: lines(`Brand: ${profile.brand.name}`, `Section: ${section.title}`, ...facts),
      },
    ];
  });
}
