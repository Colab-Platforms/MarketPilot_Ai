'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { MAX_FIELD_IMAGES, type ProfileSectionState } from '@marketpilot/contracts';
import { Alert, Button, Card, Progress, cn } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { FieldValueView } from './field-display';
import { fromDraft, isChanged, toDraft, validateDraft, type Draft } from '@/features/fields/field-draft';
import { FieldInput } from '@/features/fields/field-input';
import { ImageListInput } from '@/features/media/image-list-input';
import { LogoInput } from './logo-input';
import { SectionSwitch } from './section-switch';
import { useUpdateProfile } from './profile-api';

interface ProfileSectionProps {
  section: ProfileSectionState;
  canEdit: boolean;
  // Extra content shown above the fields, such as the product catalogue.
  lead?: ReactNode;
}

const WIDE_KINDS = new Set(['textarea', 'multiselect', 'tags']);
const LOGO_KEY = 'logoUrl';

export function ProfileSection({ section, canEdit, lead }: ProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const update = useUpdateProfile();

  const visible = section.fields.filter((f) => !f.hidden);
  const editable = visible.filter((f) => f.editable);

  function startEditing() {
    setDrafts(Object.fromEntries(editable.map((f) => [f.key, toDraft(f)])));
    setErrors({});
    setFormError(null);
    setEditing(true);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (uploading) return;
    const changed = editable.filter((f) => isChanged(f, drafts[f.key] ?? ''));
    const found: Record<string, string> = {};
    for (const field of changed) {
      const message = validateDraft(field, drafts[field.key] ?? '');
      if (message) found[field.key] = message;
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    if (changed.length === 0) return setEditing(false);

    update.mutate({ values: Object.fromEntries(changed.map((f) => [f.key, fromDraft(f, drafts[f.key] ?? '')])) }, {
      onSuccess: () => setEditing(false),
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
        setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
      },
    });
  }

  return (
    <Card id={`section-${section.id}`} role="region" aria-labelledby={`heading-${section.id}`} className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`heading-${section.id}`} className="text-title">
              {section.title}
            </h2>
            <p className="mt-1 max-w-prose text-ink-secondary">{section.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && section.canSkip && !editing ? (
              <SectionSwitch sectionId={section.id} skipped={section.skipped} />
            ) : null}
            {canEdit && !editing && !section.skipped && editable.length > 0 ? (
              <Button variant="secondary" onClick={startEditing} aria-label={`Edit ${section.title}`}>
                <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Edit
              </Button>
            ) : null}
          </div>
        </div>
        {section.total > 0 && !section.skipped ? (
          <div className="flex items-center gap-3">
            <Progress value={section.filled} max={section.total} label={`${section.title} completeness`} />
            <span className="shrink-0 text-caption text-ink-secondary">
              {section.filled} of {section.total} filled
            </span>
          </div>
        ) : null}
      </header>

      {section.skipped ? (
        <p className="rounded-md border border-line bg-subtle p-4 text-body text-ink-secondary">
          This section is turned off, so it does not count toward your profile. Turn it back on any time if it
          becomes relevant.
        </p>
      ) : (
        lead
      )}

      {visible.length === 0 || section.skipped ? null : editing ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((field) => {
              // Read-only rows (such as ones filled by a connected account) stay in place, so the
              // form shows the same fields as the section.
              if (!field.editable) {
                return (
                  <div key={field.key} className="flex flex-col gap-1">
                    <p className="text-label text-ink">{field.label}</p>
                    <FieldValueView field={field} />
                  </div>
                );
              }
              const draft = drafts[field.key] ?? '';
              const onChange = (next: Draft) => {
                setDrafts((current) => ({ ...current, [field.key]: next }));
                setErrors(({ [field.key]: _cleared, ...rest }) => rest);
              };
              if (field.kind === 'images') {
                return (
                  <div key={field.key} className="md:col-span-2">
                    <ImageListInput
                      label={field.label}
                      helper={field.helper}
                      purpose="reference_post"
                      max={MAX_FIELD_IMAGES}
                      urls={Array.isArray(draft) ? draft : []}
                      onChange={(update) => {
                        setDrafts((current) => {
                          const list = current[field.key];
                          return { ...current, [field.key]: update(Array.isArray(list) ? list : []) };
                        });
                        setErrors(({ [field.key]: _cleared, ...rest }) => rest);
                      }}
                      onUploadingChange={setUploading}
                      error={errors[field.key]}
                    />
                  </div>
                );
              }
              return field.key === LOGO_KEY ? (
                <div key={field.key} className="md:col-span-2">
                  <LogoInput
                    label={field.label}
                    value={Array.isArray(draft) ? '' : draft}
                    error={errors[field.key]}
                    onChange={onChange}
                    onUploadingChange={setUploading}
                  />
                </div>
              ) : (
                <div key={field.key} className={cn(WIDE_KINDS.has(field.kind) && 'md:col-span-2')}>
                  <FieldInput field={field} draft={draft} error={errors[field.key]} onChange={onChange} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending} disabled={uploading}>
              {uploading ? 'Uploading images' : 'Save changes'}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="flex flex-col">
          {visible.map((field) => (
            <div key={field.key} className="grid gap-1 border-t border-line py-3 md:grid-cols-3 md:gap-4">
              <dt className="text-label text-ink">{field.label}</dt>
              <dd className="min-w-0 md:col-span-2">
                <FieldValueView field={field} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
