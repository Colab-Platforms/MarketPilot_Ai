'use client';

import { useState, type FormEvent } from 'react';
import type { Competitor } from '@marketpilot/contracts';
import { Alert, Button, Field, Input, Textarea } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { useAddCompetitor, useUpdateCompetitor } from './competitor-api';

const fieldsOf = (error: unknown): Record<string, string> =>
  error instanceof ApiError
    ? Object.keys(error.fields).length > 0
      ? error.fields
      : { form: error.message }
    : { form: 'Something went wrong. Try again.' };

// Adds a competitor (when none is given) or edits one. Saving a suggestion also keeps it.
export function CompetitorEditor({ competitor, onDone }: { competitor: Competitor | null; onDone: () => void }) {
  const add = useAddCompetitor();
  const update = useUpdateCompetitor();
  const pending = add.isPending || update.isPending;
  const [values, setValues] = useState({
    name: competitor?.name ?? '',
    websiteUrl: competitor?.websiteUrl ?? '',
    summary: competitor?.summary ?? '',
    offerings: competitor?.offerings.join(', ') ?? '',
    priceRange: competitor?.priceRange ?? '',
    positioning: competitor?.positioning ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) return setErrors({ name: 'Enter a name' });
    const body = {
      name: values.name.trim(),
      websiteUrl: values.websiteUrl.trim() || null,
      summary: values.summary.trim() || null,
      offerings: values.offerings.split(/[,\n]/).map((o) => o.trim()).filter(Boolean),
      priceRange: values.priceRange.trim() || null,
      positioning: values.positioning.trim() || null,
    };
    const options = { onSuccess: onDone, onError: (error: unknown) => setErrors(fieldsOf(error)) };
    if (competitor) update.mutate({ id: competitor.id, changes: body }, options);
    else add.mutate(body, options);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border border-line bg-subtle p-4">
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input value={values.name} onChange={(e) => set('name')(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Website" error={errors.websiteUrl}>
          <Input value={values.websiteUrl} onChange={(e) => set('websiteUrl')(e.target.value)} inputMode="url" />
        </Field>
        <Field label="What they do" error={errors.summary} className="md:col-span-2">
          <Textarea rows={2} value={values.summary} onChange={(e) => set('summary')(e.target.value)} maxLength={600} />
        </Field>
        <Field label="What they sell" helper="Separate items with commas." error={errors.offerings} className="md:col-span-2">
          <Input value={values.offerings} onChange={(e) => set('offerings')(e.target.value)} />
        </Field>
        <Field label="Price level" error={errors.priceRange}>
          <Input value={values.priceRange} onChange={(e) => set('priceRange')(e.target.value)} maxLength={120} />
        </Field>
        <Field label="How they present themselves" error={errors.positioning}>
          <Input value={values.positioning} onChange={(e) => set('positioning')(e.target.value)} maxLength={600} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {competitor ? 'Save competitor' : 'Add competitor'}
        </Button>
      </div>
    </form>
  );
}
