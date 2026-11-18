import { z } from 'zod';
import {
  fieldByKey,
  fieldValueSchema,
  SCAN_FIELD_LABELS,
  scanProfileFieldSchema,
  socialProviderSchema,
  type ScanCandidate,
} from '@marketpilot/contracts';

// Stored extraction payloads are validated on the way out, like any other boundary.
export const profilePayloadSchema = z.object({
  field: scanProfileFieldSchema,
  value: z.string(),
  sourceUrl: z.string(),
});
export const socialPayloadSchema = z.object({
  provider: socialProviderSchema,
  url: z.string(),
  sourceUrl: z.string().optional(),
});
export const productPayloadSchema = z.object({
  name: z.string(),
  externalId: z.string().optional(),
  description: z.string().optional(),
  priceMinor: z.number().int().optional(),
  currency: z.string().optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'unknown']).optional(),
  sourceUrl: z.string().optional(),
});

export const aiFieldPayloadSchema = z.object({
  key: z.string(),
  value: fieldValueSchema,
  basis: z.enum(['stated', 'inferred']),
  evidence: z.string().nullable(),
  sourceUrl: z.string().nullable(),
});

export function payloadToCandidate(id: string, kind: string, payload: unknown): ScanCandidate | null {
  if (kind === 'business_profile') {
    const p = profilePayloadSchema.safeParse(payload);
    return p.success
      ? { id, kind, field: p.data.field, label: SCAN_FIELD_LABELS[p.data.field], value: p.data.value, sourceUrl: p.data.sourceUrl }
      : null;
  }
  if (kind === 'profile_field') {
    const p = aiFieldPayloadSchema.safeParse(payload);
    const def = p.success ? fieldByKey(p.data.key) : undefined;
    if (!p.success || !def) return null;
    return {
      id,
      kind,
      key: def.key,
      label: def.label,
      section: def.section,
      valueKind: def.kind,
      ...(def.options && { options: def.options.map((o) => ({ value: o.value, label: o.label })) }),
      value: p.data.value,
      basis: p.data.basis,
      evidence: p.data.evidence,
      sourceUrl: p.data.sourceUrl,
    };
  }
  if (kind === 'social_link') {
    const p = socialPayloadSchema.safeParse(payload);
    return p.success ? { id, kind, provider: p.data.provider, url: p.data.url } : null;
  }
  if (kind === 'product') {
    const p = productPayloadSchema.safeParse(payload);
    return p.success
      ? {
          id,
          kind,
          name: p.data.name,
          description: p.data.description,
          priceMinor: p.data.priceMinor,
          currency: p.data.currency,
          imageUrl: p.data.imageUrl,
          url: p.data.url,
        }
      : null;
  }
  return null;
}
