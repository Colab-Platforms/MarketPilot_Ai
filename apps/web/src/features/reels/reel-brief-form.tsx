'use client';

import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import {
  REEL_AUDIENCE_MAX_CHARS,
  REEL_GOALS,
  REEL_LANGUAGES,
  REEL_LENGTHS,
  REEL_NOTES_MAX_CHARS,
  type CreateReelInput,
  type ProductItem,
  type ReelGoal,
  type ReelLanguage,
  type ReelList,
} from '@marketpilot/contracts';
import {
  Alert,
  Button,
  Field,
  FieldGroup,
  SegmentedControl,
  Select,
  Textarea,
} from '@marketpilot/ui';

const LANGUAGE_OPTIONS = REEL_LANGUAGES.map((l) => ({ value: l.value, label: l.label }));
const LENGTH_OPTIONS = REEL_LENGTHS.map((s) => ({
  value: String(s) as `${typeof s}`,
  label: `${s} seconds`,
}));

interface ReelBriefFormProps {
  products: ProductItem[];
  defaults: ReelList['defaults'];
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (body: CreateReelInput) => void;
}

export function ReelBriefForm({
  products,
  defaults,
  submitting,
  error,
  fieldErrors,
  onSubmit,
}: ReelBriefFormProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [goal, setGoal] = useState<ReelGoal>('awareness');
  const [length, setLength] = useState<'15' | '30'>('15');
  const [language, setLanguage] = useState<ReelLanguage>(defaults.language);
  const [audience, setAudience] = useState('');
  const [notes, setNotes] = useState('');

  const goalHint = REEL_GOALS.find((g) => g.value === goal)?.hint;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!productId) return;
    onSubmit({
      productId,
      goal,
      lengthSeconds: Number(length) as 15 | 30,
      language,
      audience: audience.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field
        label="Product"
        helper="The reel is built around this product."
        error={fieldErrors.productId}
      >
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Goal" helper={goalHint}>
        <Select value={goal} onChange={(e) => setGoal(e.target.value as ReelGoal)}>
          {REEL_GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      </Field>

      <FieldGroup legend="Length">
        <SegmentedControl
          label="Length"
          options={LENGTH_OPTIONS}
          value={length}
          onChange={setLength}
        />
      </FieldGroup>

      <FieldGroup legend="Language" helper="For on-screen text and voiceover.">
        <SegmentedControl
          label="Language"
          options={LANGUAGE_OPTIONS}
          value={language}
          onChange={setLanguage}
        />
      </FieldGroup>

      <Field
        label="Who is it for?"
        optional
        helper={
          defaults.audience
            ? `Leave empty to use your profile: ${defaults.audience}`
            : 'For example: college students in Pune who care about natural hair care.'
        }
        error={fieldErrors.audience}
      >
        <Textarea
          value={audience}
          maxLength={REEL_AUDIENCE_MAX_CHARS}
          rows={2}
          onChange={(e) => setAudience(e.target.value)}
        />
      </Field>

      <Field
        label="Anything else?"
        optional
        helper="An offer, an occasion, a feeling you want, or something to avoid."
        error={fieldErrors.notes}
      >
        <Textarea
          value={notes}
          maxLength={REEL_NOTES_MAX_CHARS}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" loading={submitting} disabled={!productId} className="self-start">
        <Sparkles className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Get reel ideas
      </Button>
    </form>
  );
}
