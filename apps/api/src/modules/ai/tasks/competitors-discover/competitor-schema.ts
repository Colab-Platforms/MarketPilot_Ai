import { z } from 'zod';

export const COMPETITOR_SCHEMA_NAME = 'competitors';

const nullableText = { type: ['string', 'null'] } as const;

// Strict mode: every property is required, so optional facts are nullable instead.
export const COMPETITOR_ANSWER_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['competitors'],
  properties: {
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'website', 'summary', 'whySimilar', 'offerings', 'priceRange', 'positioning'],
        properties: {
          name: { type: 'string' },
          website: { type: 'string' },
          summary: nullableText,
          whySimilar: nullableText,
          offerings: { type: 'array', items: { type: 'string' } },
          priceRange: nullableText,
          positioning: nullableText,
        },
      },
    },
  },
};

const text = z.string().nullable().catch(null);

export const competitorAnswerSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      website: z.string(),
      summary: text,
      whySimilar: text,
      offerings: z.array(z.string()).catch([]),
      priceRange: text,
      positioning: text,
    }),
  ),
});
export type CompetitorAnswer = z.infer<typeof competitorAnswerSchema>;
