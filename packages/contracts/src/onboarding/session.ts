import { z } from 'zod';
import { accountTypeSchema } from '../identity/auth';
import { onboardingStepSchema } from './steps';

export const onboardingStatusSchema = z.enum(['in_progress', 'completed', 'abandoned']);

export const onboardingStateSchema = z.object({
  sessionId: z.string().uuid(),
  status: onboardingStatusSchema,
  track: accountTypeSchema,
  currentStep: onboardingStepSchema.nullable(),
  // The steps that apply to this account, in order.
  steps: z.array(onboardingStepSchema),
  completedSteps: z.array(onboardingStepSchema),
  brand: z.object({
    id: z.string().uuid(),
    name: z.string(),
    websiteUrl: z.string().nullable(),
    city: z.string().nullable(),
    language: z.string(),
  }),
  answers: z.record(z.unknown()),
  // Profile values already on file (for example approved from the website scan) for
  // columns the questionnaire asks about, so forms prefill instead of asking again.
  known: z.record(z.string()),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;
