import { z } from 'zod';

export const MAX_COMPETITORS = 15;
// Discovery aims for at least this many, but never invents one to reach it.
export const TARGET_COMPETITORS = 3;

export const competitorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  websiteUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  summary: z.string().nullable(),
  whySimilar: z.string().nullable(),
  offerings: z.array(z.string()),
  priceRange: z.string().nullable(),
  positioning: z.string().nullable(),
  // `suggested` came from discovery and waits for the owner to keep or remove it.
  status: z.enum(['suggested', 'kept']),
  source: z.enum(['search', 'owner']),
});
export type Competitor = z.infer<typeof competitorSchema>;

export const competitorDiscoverySchema = z.object({
  status: z.enum(['not_started', 'running', 'completed', 'failed']),
  // Plain language for the owner, such as why fewer than three were found.
  message: z.string().nullable(),
  // Discovery runs once per workspace; only a failed run that found nothing can be retried.
  canStart: z.boolean(),
});
export type CompetitorDiscovery = z.infer<typeof competitorDiscoverySchema>;

export const competitorListSchema = z.object({
  competitors: z.array(competitorSchema),
  discovery: competitorDiscoverySchema,
});
export type CompetitorList = z.infer<typeof competitorListSchema>;

const text = (max: number) => z.string().trim().max(max).nullable();

// Add (name required) or edit (only the fields sent). Editing a suggestion keeps it.
export const competitorInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(120),
    websiteUrl: text(300),
    summary: text(600),
    offerings: z.array(z.string().trim().min(1).max(120)).max(20),
    priceRange: text(120),
    positioning: text(600),
  })
  .partial()
  .strict();
export type CompetitorInput = z.infer<typeof competitorInputSchema>;

export const createCompetitorSchema = competitorInputSchema.required({ name: true });
export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;

export const updateCompetitorSchema = competitorInputSchema
  .extend({ keep: z.literal(true) })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to save');
export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;
