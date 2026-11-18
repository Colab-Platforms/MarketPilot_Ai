import { z } from 'zod';
import { fieldValueSchema } from '../profile/values';

export const scanStatusSchema = z.enum(['queued', 'running', 'completed', 'partial', 'failed', 'cancelled']);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

// Profile columns a website scan may propose. Anything else is never written.
export const SCAN_PROFILE_FIELDS = [
  'description',
  'contactEmail',
  'contactPhone',
  'addressLine',
  'city',
  'state',
  'postalCode',
  'logoUrl',
] as const;
export const scanProfileFieldSchema = z.enum(SCAN_PROFILE_FIELDS);
export type ScanProfileField = z.infer<typeof scanProfileFieldSchema>;

export const SCAN_FIELD_LABELS: Record<ScanProfileField, string> = {
  description: 'About your business',
  contactEmail: 'Email',
  contactPhone: 'Phone',
  addressLine: 'Address',
  city: 'City',
  state: 'State',
  postalCode: 'PIN code',
  logoUrl: 'Logo',
};

export const socialProviderSchema = z.enum([
  'instagram',
  'facebook',
  'whatsapp',
  'youtube',
  'linkedin',
  'tiktok',
  'pinterest',
  'x',
]);
export type SocialProviderName = z.infer<typeof socialProviderSchema>;

const candidateBase = { id: z.string().uuid() };

export const scanCandidateSchema = z.discriminatedUnion('kind', [
  z.object({
    ...candidateBase,
    kind: z.literal('business_profile'),
    field: scanProfileFieldSchema,
    label: z.string(),
    value: z.string(),
    sourceUrl: z.string(),
  }),
  // A suggestion for any profile field, written by the AI from the website content.
  z.object({
    ...candidateBase,
    kind: z.literal('profile_field'),
    key: z.string(),
    label: z.string(),
    section: z.string(),
    valueKind: z.string(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    value: fieldValueSchema,
    // `stated`: the site says this (see the quote). `inferred`: the AI's judgement.
    basis: z.enum(['stated', 'inferred']),
    evidence: z.string().nullable(),
    sourceUrl: z.string().nullable(),
  }),
  z.object({
    ...candidateBase,
    kind: z.literal('social_link'),
    provider: socialProviderSchema,
    url: z.string(),
  }),
  z.object({
    ...candidateBase,
    kind: z.literal('product'),
    name: z.string(),
    description: z.string().optional(),
    priceMinor: z.number().int().optional(),
    currency: z.string().optional(),
    imageUrl: z.string().optional(),
    url: z.string().optional(),
  }),
]);
export type ScanCandidate = z.infer<typeof scanCandidateSchema>;

export const scanStageSchema = z.enum(['reading', 'understanding', 'done']);
export type ScanStage = z.infer<typeof scanStageSchema>;
export const aiStatusSchema = z.enum(['ok', 'skipped', 'failed', 'unavailable']);
export type AiStatus = z.infer<typeof aiStatusSchema>;

export const scanStateSchema = z.object({
  id: z.string().uuid(),
  status: scanStatusSchema,
  url: z.string(),
  platform: z.string().nullable(),
  pagesFetched: z.number().int(),
  pagesDiscovered: z.number().int(),
  // While running: reading the pages, then having the AI work out the profile.
  stage: scanStageSchema,
  ai: z.object({ status: aiStatusSchema, message: z.string().nullable(), suggestions: z.number().int() }),
  // Plain-language reason when nothing usable was found.
  message: z.string().nullable(),
  candidates: z.array(scanCandidateSchema),
});
export type ScanState = z.infer<typeof scanStateSchema>;

export const scanResponseSchema = z.object({ scan: scanStateSchema.nullable() });
export type ScanResponse = z.infer<typeof scanResponseSchema>;

export const startScanSchema = z.object({ force: z.boolean().default(false) });
export type StartScanInput = z.infer<typeof startScanSchema>;

export const reviewDecisionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  // The owner's edit of a profile field value. Ignored for other kinds.
  value: z
    .union([z.string().trim().max(1500), z.array(z.string().max(100)).max(40), z.number(), z.boolean()])
    .optional(),
});

export const reviewStepSchema = z.union([
  z.object({ skipped: z.literal(true) }).strict(),
  z.object({ decisions: z.array(reviewDecisionSchema).max(100) }).strict(),
]);
export const applyReviewSchema = z.object({ decisions: z.array(reviewDecisionSchema).max(100) }).strict();
export type ApplyReviewInput = z.infer<typeof applyReviewSchema>;
export type ReviewStepInput = z.infer<typeof reviewStepSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

// Value rules applied when an approved profile field is written.
export const profileFieldValueSchemas: Record<ScanProfileField, z.ZodType<string>> = {
  description: z.string().trim().min(1).max(600),
  contactEmail: z.string().trim().toLowerCase().email().max(120),
  contactPhone: z.string().trim().min(5).max(30),
  addressLine: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(3).max(12),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), 'Logo must be a web address'),
};
