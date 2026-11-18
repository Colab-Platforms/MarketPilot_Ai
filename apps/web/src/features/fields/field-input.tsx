'use client';

import type { ProfileFieldState } from '@marketpilot/contracts';
import { Checkbox, Field, FieldGroup, Input, Select, Textarea } from '@marketpilot/ui';
import type { Draft } from './field-draft';

interface FieldInputProps {
  field: ProfileFieldState;
  draft: Draft;
  error?: string;
  onChange: (draft: Draft) => void;
}

const helperFor = (field: ProfileFieldState) =>
  field.kind === 'tags' ? (field.helper ? `${field.helper} Separate items with commas.` : 'Separate items with commas.') : field.helper;

export function FieldInput({ field, draft, error, onChange }: FieldInputProps) {
  const text = Array.isArray(draft) ? '' : draft;

  if (field.kind === 'multiselect') {
    const selected = Array.isArray(draft) ? draft : [];
    return (
      <FieldGroup legend={field.label} helper={field.helper} error={error}>
        <div className="flex flex-col gap-1">
          {(field.options ?? []).map((option) => (
            <label key={option.value} className="flex min-h-touch cursor-pointer items-center gap-3 text-body">
              <Checkbox
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...selected, option.value] : selected.filter((v) => v !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </FieldGroup>
    );
  }

  return (
    <Field label={field.label} helper={helperFor(field)} error={error}>
      {field.kind === 'textarea' ? (
        <Textarea rows={4} value={text} maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === 'select' || field.kind === 'yesno' ? (
        <Select value={text} onChange={(e) => onChange(e.target.value)}>
          {field.required ? null : <option value="">Not set</option>}
          {field.kind === 'yesno' ? (
            <>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </>
          ) : (
            (field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          )}
        </Select>
      ) : (
        <Input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          maxLength={field.maxLength}
          type={field.kind === 'date' ? 'date' : field.kind === 'email' ? 'email' : 'text'}
          inputMode={
            field.kind === 'phone'
              ? 'tel'
              : field.kind === 'url'
                ? 'url'
                : field.kind === 'number' || field.kind === 'year' || field.kind === 'money'
                  ? 'numeric'
                  : undefined
          }
        />
      )}
    </Field>
  );
}
