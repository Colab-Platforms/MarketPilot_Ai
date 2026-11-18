import { z } from 'zod';

export const autonomyLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export type AutonomyLevel = z.infer<typeof autonomyLevelSchema>;

export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = 1;
