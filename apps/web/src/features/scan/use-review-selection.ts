import { useState } from 'react';
import { profileFieldValueSchemas, type ReviewDecision, type ScanCandidate } from '@marketpilot/contracts';
import { fromDraft, isChanged, toDraft, validateDraft, type Draft } from '@/features/fields/field-draft';
import { candidateAsField } from './candidate-field';
import type { RowState } from './review-candidates';

type ProfileCandidate = Extract<ScanCandidate, { kind: 'business_profile' }>;
type AiCandidate = Extract<ScanCandidate, { kind: 'profile_field' }>;

// What the owner has ticked and edited in a list of scan results. Everything starts
// ticked; nothing is saved until the caller submits the decisions.
export function useReviewSelection(candidates: ScanCandidate[]) {
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  function rowsFor(serverErrors: Record<string, string>, clearServerError: (id: string) => void): RowState {
    const clearErrors = (id: string) => {
      setClientErrors(({ [id]: _cleared, ...rest }) => rest);
      clearServerError(id);
    };
    return {
      isChecked: (id) => !unchecked.has(id),
      toggle: (id) =>
        setUnchecked((current) => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        }),
      valueOf: (candidate: ProfileCandidate) => edits[candidate.id] ?? candidate.value,
      edit: (id, value) => {
        setEdits((current) => ({ ...current, [id]: value }));
        clearErrors(id);
      },
      draftOf: (candidate: AiCandidate) => drafts[candidate.id] ?? toDraft(candidateAsField(candidate)),
      editDraft: (id, draft) => {
        setDrafts((current) => ({ ...current, [id]: draft }));
        clearErrors(id);
      },
      errors: { ...serverErrors, ...clientErrors },
    };
  }

  // Returns the decisions to send, or null when an edited value is not valid
  // (the problems are then shown next to the fields).
  function buildDecisions(): ReviewDecision[] | null {
    const found: Record<string, string> = {};
    const decisions = candidates.map((candidate): ReviewDecision => {
      if (unchecked.has(candidate.id)) return { id: candidate.id, action: 'reject' };

      if (candidate.kind === 'profile_field') {
        const field = candidateAsField(candidate);
        const draft = drafts[candidate.id];
        // Checked even when untouched: the AI's own value must satisfy the same rules.
        const message = validateDraft(field, draft ?? toDraft(field));
        if (message) found[candidate.id] = message;
        const changed = draft !== undefined && isChanged(field, draft);
        return {
          id: candidate.id,
          action: 'approve',
          ...(changed && { value: fromDraft(field, draft) as ReviewDecision['value'] }),
        };
      }

      if (candidate.kind !== 'business_profile') return { id: candidate.id, action: 'approve' };
      const value = edits[candidate.id] ?? candidate.value;
      const parsed = profileFieldValueSchemas[candidate.field].safeParse(value);
      if (!parsed.success) found[candidate.id] = parsed.error.issues[0]?.message ?? 'Check this value';
      return { id: candidate.id, action: 'approve', ...(edits[candidate.id] !== undefined && { value }) };
    });
    setClientErrors(found);
    return Object.keys(found).length === 0 ? decisions : null;
  }

  return { rowsFor, buildDecisions };
}
