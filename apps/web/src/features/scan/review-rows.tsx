'use client';

import { Input, Textarea, Field } from '@marketpilot/ui';
import { FieldInput } from '@/features/fields/field-input';
import type { Draft } from '@/features/fields/field-draft';
import { candidateAsField } from './candidate-field';
import { asColours, showDraft, showText } from './review-format';
import { ReviewRow } from './review-row';
import type { AiCandidate, ProfileCandidate, RowState } from './row-state';

interface RowProps<C> {
  candidate: C;
  rows: RowState;
  sourceLabel: string;
  label?: string;
}

// A detail copied from the website (email, address, description...).
export function ProfileReviewRow({ candidate, rows, sourceLabel, label }: RowProps<ProfileCandidate>) {
  const name = label ?? candidate.label;
  return (
    <ReviewRow<string>
      label={name}
      tag="website"
      sourceLabel={sourceLabel}
      value={rows.valueOf(candidate)}
      show={showText}
      checked={rows.isChecked(candidate.id)}
      onCheckedChange={(checked) => rows.setChecked([candidate.id], checked)}
      onSave={(value) => rows.edit(candidate.id, value)}
      error={rows.errors[candidate.id]}
      renderEditor={(value, onChange) => (
        <Field label={name} hideLabel error={rows.errors[candidate.id]}>
          {candidate.field === 'description' ? (
            <Textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
          ) : (
            <Input
              value={value}
              inputMode={candidate.field === 'contactPhone' ? 'tel' : undefined}
              type={candidate.field === 'contactEmail' ? 'email' : 'text'}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Field>
      )}
    />
  );
}

// A detail the AI wrote from the website. `stated` ones are quoted from the site;
// `inferred` ones are its judgement, so they ask the owner to check.
export function AiReviewRow({
  candidate,
  rows,
  sourceLabel,
  label,
  colours = false,
}: RowProps<AiCandidate> & { colours?: boolean }) {
  const field = candidateAsField(candidate);
  const show = (draft: Draft) => (colours ? asColours(showDraft(field, draft)) : showDraft(field, draft));
  return (
    <ReviewRow<Draft>
      label={label ?? candidate.label}
      tag={candidate.basis === 'stated' ? 'website' : 'check'}
      sourceLabel={sourceLabel}
      value={rows.draftOf(candidate)}
      show={show}
      checked={rows.isChecked(candidate.id)}
      onCheckedChange={(checked) => rows.setChecked([candidate.id], checked)}
      onSave={(draft) => rows.editDraft(candidate.id, draft)}
      error={rows.errors[candidate.id]}
      renderEditor={(draft, onChange) => (
        <FieldInput field={field} draft={draft} error={rows.errors[candidate.id]} hideLabel onChange={onChange} />
      )}
    />
  );
}
