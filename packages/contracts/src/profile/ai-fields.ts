import type { ProfileFieldDef, SectionId } from './types';

// The fields a model may suggest. Everything else is either deterministic (contact
// details, links, prices, products), numeric or personal (budgets, headcount, year),
// the owner's own intent (goals, approvals) or needs real research (competitors).
//
// `stated`: only what the website actually says, backed by a quote.
// `inferred`: a reasoned judgement from the site, always labelled as a suggestion.
export type AiMode = 'stated' | 'inferred';

const AI_FIELD_MODES: Record<string, AiMode> = {
  // Basic profile
  category: 'inferred',
  subcategory: 'inferred',
  description: 'stated',
  operatingModel: 'inferred',
  // Products and services
  productFeatures: 'stated',
  productBenefits: 'stated',
  productMaterials: 'stated',
  servicesOffered: 'stated',
  serviceBenefits: 'stated',
  serviceBookingProcess: 'stated',
  // Audience
  audienceSummary: 'inferred',
  secondaryAudience: 'inferred',
  audienceAgeGroups: 'inferred',
  audienceLocations: 'inferred',
  audienceInterests: 'inferred',
  audiencePreferences: 'inferred',
  audienceBuyingBehaviour: 'inferred',
  audienceIncomeSegment: 'inferred',
  audiencePainPoints: 'inferred',
  audienceExpectations: 'inferred',
  reasonsToChoose: 'inferred',
  idealCustomer: 'inferred',
  customerPersonas: 'inferred',
  // Brand identity
  tagline: 'stated',
  mission: 'stated',
  vision: 'stated',
  values: 'stated',
  personality: 'inferred',
  positioning: 'inferred',
  story: 'stated',
  communicationStyle: 'inferred',
  toneOfVoice: 'inferred',
  wordsToUse: 'inferred',
  // Differentiation (from the site's own claims, not from outside knowledge)
  differentiation: 'inferred',
  usp: 'inferred',
  // Content
  contentThemes: 'inferred',
  // Sales and customer journey
  paymentMethods: 'stated',
  shippingMethods: 'stated',
  'policy.return_policy': 'stated',
  'policy.cancellation': 'stated',
  'policy.warranty': 'stated',
  bookingProcess: 'stated',
  enquiryProcess: 'stated',
  supportChannels: 'stated',
  faqs: 'stated',
  loyaltyProgramme: 'stated',
  referralProgramme: 'stated',
  // Offers and reputation
  currentPromotions: 'stated',
  testimonials: 'stated',
  positiveThemes: 'inferred',
  customerQuestions: 'inferred',
};

export function aiModeOf(def: ProfileFieldDef): AiMode | null {
  // Category packs ask for facts a business of that kind publishes (menu, courses, fees).
  if (def.pack) return 'stated';
  return AI_FIELD_MODES[def.key] ?? null;
}

// Fields are asked for in a few groups, so each answer format stays small and reliable.
export type AiGroup = 'identity' | 'offering' | 'audience';

const GROUP_BY_SECTION: Record<SectionId, AiGroup> = {
  basics: 'identity',
  brand: 'identity',
  products: 'offering',
  sales: 'offering',
  offers: 'offering',
  reputation: 'offering',
  specific: 'offering',
  audience: 'audience',
  competitors: 'audience',
  content: 'audience',
  goals: 'audience',
  social: 'audience',
};

export const AI_GROUPS: readonly AiGroup[] = ['identity', 'offering', 'audience'];

export function aiGroupOf(def: ProfileFieldDef): AiGroup {
  return GROUP_BY_SECTION[def.section];
}
