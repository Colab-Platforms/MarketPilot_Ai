import type { AccountType } from '../identity/auth';
import type { QuestionOption } from '../onboarding/questions';
import type { SocialProviderName } from '../onboarding/scan';

export type SectionId =
  | 'basics'
  | 'products'
  | 'audience'
  | 'brand'
  | 'goals'
  | 'social'
  | 'competitors'
  | 'content'
  | 'sales'
  | 'offers'
  | 'reputation'
  | 'specific';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'url'
  | 'email'
  | 'phone'
  | 'number'
  | 'year'
  | 'money'
  | 'yesno'
  | 'date'
  | 'hours'
  // A list of uploaded image URLs, such as reference posts.
  | 'images';

// Where a value normally comes from. Shown as a hint, never enforced.
export type FieldSource = 'website' | 'owner' | 'ai' | 'connection';

export type PolicyKindName = 'return_policy' | 'cancellation' | 'warranty';

export type FieldStorage =
  // Columns on the brand itself.
  | { type: 'brand'; column: 'name' | 'websiteUrl' | 'scale' | 'language' | 'secondaryLanguages' }
  // A typed column on brand_profile.
  | { type: 'column'; column: string }
  // A key in the brand_profile `attributes` JSON map.
  | { type: 'attribute'; key: string }
  | { type: 'social'; provider: SocialProviderName }
  | { type: 'policy'; kind: PolicyKindName }
  // Read-only: derived from the catalogue (edit products to change it).
  | { type: 'summary'; of: 'names' | 'categories' | 'descriptions' | 'images' | 'pricing' | 'availability' }
  // Read-only: filled from connected accounts once they are linked.
  | { type: 'connection' }
  // Read-only: shows another field's value (for example Brand name = Business name).
  | { type: 'alias'; of: string };

export interface ProfileFieldDef {
  // The brief's number (1 to 176), or a string for additions beyond it.
  id: number | string;
  section: SectionId;
  // Unique. The key used in PUT bodies and in the provenance map.
  key: string;
  label: string;
  kind: FieldKind;
  storage: FieldStorage;
  sources: readonly FieldSource[];
  helper?: string;
  options?: readonly QuestionOption[];
  maxLength?: number;
  // Fields shown to only one account type. Absent means both.
  tracks?: readonly AccountType[];
  // Category-specific packs (section "specific") show only for that category.
  pack?: string;
  // Cannot be cleared (the brand must keep a name).
  required?: boolean;
  // Kept off the owner's screens to keep the form short. Still stored, filled by the scan
  // and AI, and used as context.
  hidden?: boolean;
}

export interface SectionDef {
  id: SectionId;
  title: string;
  description: string;
}

export function isEditable(field: ProfileFieldDef): boolean {
  const type = field.storage.type;
  return type !== 'summary' && type !== 'connection' && type !== 'alias';
}
