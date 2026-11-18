import { fieldByKey, type ProfileFieldState, type ScanCandidate } from '@marketpilot/contracts';

type AiCandidate = Extract<ScanCandidate, { kind: 'profile_field' }>;

// Presents an AI suggestion in the shape the profile editor's inputs and rules expect,
// so a suggestion is edited and checked exactly like any other profile field.
export function candidateAsField(candidate: AiCandidate): ProfileFieldState {
  const def = fieldByKey(candidate.key);
  return {
    id: candidate.key,
    key: candidate.key,
    label: candidate.label,
    kind: candidate.valueKind,
    ...(def?.helper && { helper: def.helper }),
    ...(candidate.options && { options: candidate.options }),
    ...(def?.maxLength && { maxLength: def.maxLength }),
    editable: true,
    sources: [],
    value: candidate.value,
    display: null,
    status: 'ai',
    sourceUrl: candidate.sourceUrl,
    updatedAt: null,
  };
}
