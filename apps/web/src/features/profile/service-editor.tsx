'use client';

import { useState, type FormEvent } from 'react';
import type { ServiceItem } from '@marketpilot/contracts';
import { Alert, Button, Checkbox, Field, Input, Textarea } from '@marketpilot/ui';
import { saveErrors } from './save-errors';
import { useUpdateProfile } from './profile-api';

// Adds a service (when none is given) or edits one, through the single profile update.
export function ServiceEditor({ service, onDone }: { service: ServiceItem | null; onDone: () => void }) {
  const update = useUpdateProfile();
  const [values, setValues] = useState({
    name: service?.name ?? '',
    description: service?.description ?? '',
    price: service?.priceMinor == null ? '' : String(service.priceMinor / 100),
    durationMinutes: service?.durationMinutes == null ? '' : String(service.durationMinutes),
    benefits: (service?.benefits ?? []).join('\n'),
    bookingProcess: service?.bookingProcess ?? '',
    featured: service?.featured ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const price = values.price.trim() === '' ? null : Number(values.price.replace(/,/g, ''));
    const minutes = values.durationMinutes.trim() === '' ? null : Number(values.durationMinutes);
    const found: Record<string, string> = {};
    if (!values.name.trim()) found.name = 'Enter a name';
    if (price !== null && (!Number.isFinite(price) || price < 0)) found.price = 'Enter a price, like 1499';
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1)) found.durationMinutes = 'Enter whole minutes';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    update.mutate(
      {
        services: [
          {
            ...(service && { id: service.id }),
            name: values.name.trim(),
            description: values.description.trim() || null,
            price,
            durationMinutes: minutes,
            benefits: values.benefits.split('\n').map((line) => line.trim()).filter(Boolean),
            bookingProcess: values.bookingProcess.trim() || null,
            featured: values.featured,
          },
        ],
      },
      { onSuccess: onDone, onError: (error) => setErrors(saveErrors(error, 'services.0')) },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border border-line bg-subtle p-4">
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name} className="md:col-span-2">
          <Input value={values.name} onChange={(e) => set('name')(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Price (rupees)" error={errors.price}>
          <Input value={values.price} onChange={(e) => set('price')(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="How long it takes (minutes)" error={errors.durationMinutes}>
          <Input value={values.durationMinutes} onChange={(e) => set('durationMinutes')(e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Description" error={errors.description} className="md:col-span-2">
          <Textarea rows={3} value={values.description} onChange={(e) => set('description')(e.target.value)} />
        </Field>
        <Field label="Benefits (one per line)" error={errors.benefits} className="md:col-span-2">
          <Textarea rows={3} value={values.benefits} onChange={(e) => set('benefits')(e.target.value)} />
        </Field>
        <Field label="How to book" error={errors.bookingProcess} className="md:col-span-2">
          <Input value={values.bookingProcess} onChange={(e) => set('bookingProcess')(e.target.value)} maxLength={500} />
        </Field>
      </div>
      <label className="flex min-h-touch items-center gap-3 text-body text-ink">
        <Checkbox checked={values.featured} onChange={(e) => set('featured')(e.target.checked)} />
        One of our most popular services
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          {service ? 'Save service' : 'Add service'}
        </Button>
      </div>
    </form>
  );
}
