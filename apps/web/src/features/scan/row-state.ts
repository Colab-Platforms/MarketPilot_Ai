import type { ScanCandidate } from '@marketpilot/contracts';
import type { Draft } from '@/features/fields/field-draft';

export type ProfileCandidate = Extract<ScanCandidate, { kind: 'business_profile' }>;
export type AiCandidate = Extract<ScanCandidate, { kind: 'profile_field' }>;
export type SocialCandidate = Extract<ScanCandidate, { kind: 'social_link' }>;
export type ProductCandidate = Extract<ScanCandidate, { kind: 'product' }>;

export interface RowState {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
  setChecked: (ids: string[], checked: boolean) => void;
  valueOf: (candidate: ProfileCandidate) => string;
  edit: (id: string, value: string) => void;
  // For AI suggestions, whose values can be lists, choices or text.
  draftOf: (candidate: AiCandidate) => Draft;
  editDraft: (id: string, draft: Draft) => void;
  errors: Record<string, string>;
}
