import type { AccountType } from '../identity/auth';

export type QuestionStep = 'about' | 'goals';

export type QuestionKind = 'text' | 'textarea' | 'select' | 'multiselect' | 'tags' | 'money';

export interface QuestionOption {
  value: string;
  label: string;
}

// `column` writes to a BrandProfile column; `attribute` writes to the JSONB
// `attributes` map. `money` answers are whole rupees, stored as minor units.
export interface QuestionDef {
  id: string;
  step: QuestionStep;
  tracks: readonly AccountType[];
  store: 'column' | 'attribute';
  field: string;
  kind: QuestionKind;
  label: string;
  helper?: string;
  required: boolean;
  options?: readonly QuestionOption[];
  maxLength?: number;
}

const both = ['creator', 'business'] as const;
const business = ['business'] as const;
const creator = ['creator'] as const;

export const BUSINESS_CATEGORIES: readonly QuestionOption[] = [
  { value: 'fashion', label: 'Fashion and apparel' },
  { value: 'restaurant', label: 'Restaurant, cafe or food' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education and coaching' },
  { value: 'fitness', label: 'Fitness and wellness' },
  { value: 'beauty', label: 'Beauty and salon' },
  { value: 'ecommerce', label: 'Online store' },
  { value: 'travel', label: 'Travel and hospitality' },
  { value: 'services', label: 'Other services' },
  { value: 'other', label: 'Something else' },
];

export const TONES: readonly QuestionOption[] = [
  { value: 'friendly', label: 'Friendly and warm' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
  { value: 'premium', label: 'Premium and refined' },
  { value: 'bold', label: 'Bold and direct' },
];

export const CHANNELS: readonly QuestionOption[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export const OBJECTIVES: readonly QuestionOption[] = [
  { value: 'sales', label: 'Get more sales' },
  { value: 'leads', label: 'Get more enquiries' },
  { value: 'awareness', label: 'Make more people aware of us' },
  { value: 'followers', label: 'Grow our followers' },
  { value: 'traffic', label: 'Bring more visitors to our website' },
  { value: 'engagement', label: 'Get more likes, comments and shares' },
];

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: 'business_category',
    step: 'about',
    tracks: business,
    store: 'column',
    field: 'category',
    kind: 'select',
    label: 'What kind of business is it?',
    required: true,
    options: BUSINESS_CATEGORIES,
  },
  {
    id: 'business_description',
    step: 'about',
    tracks: business,
    store: 'column',
    field: 'description',
    kind: 'textarea',
    label: 'What do you sell or offer?',
    helper: 'One or two sentences is enough. You can refine it later.',
    required: true,
    maxLength: 600,
  },
  {
    id: 'business_model',
    step: 'about',
    tracks: business,
    store: 'column',
    field: 'operatingModel',
    kind: 'select',
    label: 'Who do you mainly sell to?',
    required: false,
    options: [
      { value: 'b2c', label: 'Individual customers' },
      { value: 'b2b', label: 'Other businesses' },
      { value: 'd2c', label: 'Customers directly through our own online store' },
      { value: 'mixed', label: 'Both' },
    ],
  },
  {
    id: 'creator_niche',
    step: 'about',
    tracks: creator,
    store: 'column',
    field: 'niche',
    kind: 'text',
    label: 'What do you create content about?',
    helper: 'For example: street food, fitness for beginners, personal finance.',
    required: true,
    maxLength: 120,
  },
  {
    id: 'creator_type',
    step: 'about',
    tracks: creator,
    store: 'attribute',
    field: 'creatorType',
    kind: 'select',
    label: 'How would you describe yourself?',
    required: false,
    options: [
      { value: 'influencer', label: 'Influencer or content creator' },
      { value: 'personal_brand', label: 'Personal brand' },
      { value: 'coach', label: 'Coach, consultant or expert' },
      { value: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'creator_description',
    step: 'about',
    tracks: creator,
    store: 'column',
    field: 'description',
    kind: 'textarea',
    label: 'Tell us about you and your content',
    required: true,
    maxLength: 600,
  },
  {
    id: 'audience_summary',
    step: 'about',
    tracks: both,
    store: 'attribute',
    field: 'audienceSummary',
    kind: 'textarea',
    label: 'Who are you trying to reach?',
    helper: 'Age, city, interests, whatever you know.',
    required: false,
    maxLength: 400,
  },
  {
    id: 'tone_of_voice',
    step: 'about',
    tracks: both,
    store: 'column',
    field: 'toneOfVoice',
    kind: 'select',
    label: 'How should your posts sound?',
    required: false,
    options: TONES,
  },
  {
    id: 'topics_to_avoid',
    step: 'about',
    tracks: both,
    store: 'column',
    field: 'topicsToAvoid',
    kind: 'tags',
    label: 'Anything we should never post about?',
    helper: 'Separate with commas.',
    required: false,
  },
  {
    id: 'primary_objective',
    step: 'goals',
    tracks: both,
    store: 'column',
    field: 'primaryObjective',
    kind: 'select',
    label: 'What is the main thing you want from marketing?',
    required: true,
    options: OBJECTIVES,
  },
  {
    id: 'preferred_channels',
    step: 'goals',
    tracks: both,
    store: 'column',
    field: 'preferredChannels',
    kind: 'multiselect',
    label: 'Where do you want to post?',
    required: true,
    options: CHANNELS,
  },
  {
    id: 'monthly_budget',
    step: 'goals',
    tracks: both,
    store: 'column',
    field: 'monthlyBudgetMinor',
    kind: 'money',
    label: 'Monthly marketing budget in rupees',
    helper: 'Optional. It helps us size the plan.',
    required: false,
  },
];

export function questionsFor(step: QuestionStep, track: AccountType): QuestionDef[] {
  return QUESTIONS.filter((q) => q.step === step && q.tracks.includes(track));
}
