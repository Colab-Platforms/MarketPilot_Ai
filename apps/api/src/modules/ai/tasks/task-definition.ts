import type { ZodType } from 'zod';

export type ModelTier = 'reasoning' | 'writing' | 'classification' | 'vision' | 'image' | 'speech';

export interface TaskDefinition<TOutput> {
  id: string;
  promptVersion: string;
  outputSchema: ZodType<TOutput, never, unknown>;
  routing: {
    tier: ModelTier;
    maxLatencyMs: number;
    fallbackTiers?: ModelTier[];
  };
  credits: number;
}
