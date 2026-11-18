import type { AccountType } from '../identity/auth';
import { IDENTITY_FIELDS } from './fields-identity';
import { MARKETING_FIELDS } from './fields-marketing';
import { OPERATIONS_FIELDS } from './fields-operations';
import { PACK_FIELDS } from './packs';
import type { ProfileFieldDef, SectionDef, SectionId } from './types';

export const SECTIONS: readonly SectionDef[] = [
  { id: 'basics', title: 'Basic business profile', description: 'Who you are, where you operate and how to reach you.' },
  { id: 'products', title: 'Products and services', description: 'What you sell. Your catalogue is read from your website.' },
  { id: 'audience', title: 'Customers and audience', description: 'Who you want to reach and what they care about.' },
  { id: 'brand', title: 'Brand identity', description: 'How your brand looks and sounds, so everything we make feels like you.' },
  { id: 'goals', title: 'Marketing goals', description: 'What you want from marketing, and what you can spend.' },
  { id: 'social', title: 'Social media presence', description: 'Your profiles. Connecting an account to publish is a separate step.' },
  { id: 'competitors', title: 'Competitors', description: 'Optional. Who you compete with and how you differ.' },
  { id: 'content', title: 'Content preferences', description: 'The kinds of posts, videos and language you prefer.' },
  { id: 'sales', title: 'Sales and customer journey', description: 'How customers buy, pay and get help.' },
  { id: 'offers', title: 'Offers and campaigns', description: 'Promotions, launches and campaign plans.' },
  { id: 'reputation', title: 'Online reputation', description: 'What customers say about you.' },
  { id: 'specific', title: 'Specific to your business', description: 'Questions that depend on your kind of business.' },
];

export const PROFILE_FIELDS: readonly ProfileFieldDef[] = [
  ...IDENTITY_FIELDS,
  ...MARKETING_FIELDS,
  ...OPERATIONS_FIELDS,
  ...PACK_FIELDS,
];

// The core of every profile, and the catalogue (which has no count), cannot be switched off.
const ALWAYS_ON: ReadonlySet<SectionId> = new Set(['basics', 'products']);

export function canSkipSection(id: string): boolean {
  return SECTIONS.some((s) => s.id === id) && !ALWAYS_ON.has(id as SectionId);
}

const byKey = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));

export function fieldByKey(key: string): ProfileFieldDef | undefined {
  return byKey.get(key);
}

export function isHiddenField(key: string): boolean {
  return byKey.get(key)?.hidden === true;
}

// The fields that apply to this account: its track, and only the pack for its category.
export function fieldsFor(track: AccountType, category: string | null): ProfileFieldDef[] {
  return PROFILE_FIELDS.filter(
    (f) => (!f.tracks || f.tracks.includes(track)) && (!f.pack || f.pack === category),
  );
}

export function sectionFields(fields: readonly ProfileFieldDef[], section: SectionId): ProfileFieldDef[] {
  return fields.filter((f) => f.section === section);
}
