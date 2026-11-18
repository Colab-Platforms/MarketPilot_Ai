'use client';

import { useState } from 'react';
import { basicsStepSchema, LANGUAGES, type OnboardingState } from '@marketpilot/contracts';
import { Field, Input, Select } from '@marketpilot/ui';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

interface SavedBasics {
  brandName?: string;
  websiteUrl?: string;
  city?: string;
  language?: string;
}

export function BasicsStep({ state }: { state: OnboardingState }) {
  const saved = (state.answers.basics ?? {}) as SavedBasics;
  const isBusiness = state.track === 'business';
  const { submit, saving, fieldErrors, setFieldErrors, formError } = useStepSubmit('basics');
  const [values, setValues] = useState({
    brandName: saved.brandName ?? '',
    websiteUrl: saved.websiteUrl ?? '',
    city: saved.city ?? '',
    language: saved.language ?? state.brand.language,
  });

  const set = (key: keyof typeof values) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  function onSubmit() {
    const parsed = basicsStepSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    submit(values);
  }

  return (
    <StepFrame
      step="basics"
      title={isBusiness ? 'Tell us about your business' : 'Tell us who you are'}
      description="Just the essentials. We will ask about your goals next."
      error={formError}
      saving={saving}
      onSubmit={onSubmit}
    >
      <Field
        label={isBusiness ? 'Business name' : 'Your name or brand name'}
        error={fieldErrors.brandName}
      >
        <Input
          value={values.brandName}
          onChange={(event) => set('brandName')(event.target.value)}
          autoComplete="organization"
          autoFocus
        />
      </Field>
      <Field
        label={isBusiness ? 'Website' : 'Website or link-in-bio page'}
        helper="Optional. We will use it later to learn about you, so you type less."
        error={fieldErrors.websiteUrl}
        optional
      >
        <Input
          value={values.websiteUrl}
          onChange={(event) => set('websiteUrl')(event.target.value)}
          inputMode="url"
          autoComplete="url"
          placeholder="yourbrand.in"
        />
      </Field>
      <Field label="City" error={fieldErrors.city} optional>
        <Input
          value={values.city}
          onChange={(event) => set('city')(event.target.value)}
          autoComplete="address-level2"
        />
      </Field>
      <Field label="Main language for your posts" error={fieldErrors.language}>
        <Select value={values.language} onChange={(event) => set('language')(event.target.value)}>
          {LANGUAGES.map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </Select>
      </Field>
    </StepFrame>
  );
}
