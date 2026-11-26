import { z } from 'zod';
import { accountTypeSchema, type AccountType } from '../identity/auth';
import { SALES_CHANNEL_OPTIONS } from '../profile/define';
import { classifyLink } from './links';
import { questionsFor, type QuestionDef, type QuestionStep } from './questions';

// Order matters. `review` (website scan results) only applies to a business with a website.
export const ONBOARDING_STEPS = ['type', 'basics', 'review', 'about', 'goals'] as const;
export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'bn', label: 'Bengali' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
] as const;

export const typeStepSchema = z.object({ accountType: accountTypeSchema });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

function toUrl(value: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

const websiteUrlSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .refine((value) => !value || toUrl(value)?.hostname.includes('.') === true, {
    message: 'Enter a valid website address',
  })
  .transform((value) => (value ? (toUrl(value)?.toString() ?? undefined) : undefined));

const languageSchema = z.enum(LANGUAGES.map((l) => l.value) as [string, ...string[]]);
const salesChannelSchema = z.enum(SALES_CHANNEL_OPTIONS.map((o) => o.value) as [string, ...string[]]);

const socialLinkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((value) => classifyLink(value) !== null, { message: 'Enter a valid link' })
  .transform((value) => classifyLink(value)?.url ?? value);

export const basicsStepSchema = z.object({
  brandName: z.string().trim().min(1, 'Enter a name').max(120),
  websiteUrl: websiteUrlSchema,
  city: optionalText(80),
  // Optional: the Voice step sets post languages. Older clients still send one here.
  language: languageSchema.optional(),
  // How customers buy, from the profile's sales channel options.
  salesChannels: z.array(salesChannelSchema).max(SALES_CHANNEL_OPTIONS.length).optional(),
  // Social pages and Google Maps links pasted on the link screen.
  socialLinks: z.array(socialLinkSchema).max(4).optional(),
});

// Sent with the `about` answers: up to three post languages, the first is the main one.
export const postLanguagesSchema = z.array(languageSchema).min(1, 'Pick a language').max(3, 'Pick up to 3');

export type TypeStepInput = z.infer<typeof typeStepSchema>;
export type BasicsStepInput = z.infer<typeof basicsStepSchema>;
export type QuestionAnswers = Record<string, unknown>;

function answerSchema(question: QuestionDef): z.ZodTypeAny {
  const optionValues = (question.options ?? []).map((o) => o.value) as [string, ...string[]];
  switch (question.kind) {
    case 'text':
    case 'textarea': {
      const base = z.string().trim().max(question.maxLength ?? 300);
      return question.required ? base.min(1, 'This is required') : base.optional();
    }
    case 'select': {
      const base = z.enum(optionValues, { errorMap: () => ({ message: 'Choose one' }) });
      return question.required ? base : base.optional();
    }
    case 'multiselect': {
      const option = z.enum(optionValues, { errorMap: () => ({ message: 'Choose from the options shown' }) });
      const base = z.array(option).max(optionValues.length);
      return question.required ? base.min(1, 'Choose at least one') : base.optional();
    }
    case 'tags':
      return z.array(z.string().trim().min(1).max(60)).max(20).optional();
    case 'money':
      return z.number().int().min(0).max(100_000_000).optional();
  }
}

export function questionStepSchema(step: QuestionStep, track: AccountType) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const question of questionsFor(step, track)) {
    shape[question.id] = answerSchema(question);
  }
  return z.object(shape).strict();
}

export function onboardingStepsFor(track: AccountType, hasWebsite: boolean): OnboardingStep[] {
  const scanApplies = track === 'business' && hasWebsite;
  return ONBOARDING_STEPS.filter((step) => step !== 'review' || scanApplies);
}

export function nextStep(
  completed: readonly OnboardingStep[],
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): OnboardingStep | null {
  return steps.find((step) => !completed.includes(step)) ?? null;
}
