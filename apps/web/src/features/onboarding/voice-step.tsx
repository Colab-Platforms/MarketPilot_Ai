'use client';

import { useState, type KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import { LANGUAGES, questionsFor, questionStepSchema, type OnboardingState } from '@marketpilot/contracts';
import { ChoiceCard, FieldGroup, cn } from '@marketpilot/ui';
import { QuestionField, type AnswerValue } from './question-field';
import { AVOID_SUGGESTIONS, TONE_CARDS } from './setup-copy';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';
import { VoicePreview } from './voice-preview';

const MAX_LANGUAGES = 3;
const pill = 'flex min-h-touch items-center gap-2 rounded-full px-4 text-body font-semibold transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

type Saved = Record<string, unknown> & { postLanguages?: string[]; topics_to_avoid?: string[]; tone_of_voice?: string };

export function VoiceStep({ state }: { state: OnboardingState }) {
  const saved = (state.answers.about ?? {}) as Saved;
  const track = state.track;
  const { submit, saving, fieldErrors, setFieldErrors, formError } = useStepSubmit('about');
  // Required "what you do" questions show only when the website did not already answer them.
  const required = questionsFor('about', track).filter((q) => q.required);
  const toAsk = required.filter((q) => !state.known[q.field]);
  const [basics, setBasics] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(required.map((q) => [q.id, String(saved[q.id] ?? state.known[q.field] ?? '')])),
  );
  const [languages, setLanguages] = useState<string[]>(saved.postLanguages ?? [state.brand.language]);
  const tones = TONE_CARDS[track];
  const [tone, setTone] = useState(saved.tone_of_voice ?? state.known.toneOfVoice ?? tones[0]?.value ?? '');
  const [avoid, setAvoid] = useState<string[]>(saved.topics_to_avoid ?? []);
  const [avoidDraft, setAvoidDraft] = useState('');
  const [languageError, setLanguageError] = useState<string>();

  const preview = tones.find((t) => t.value === tone) ?? tones[0];

  function toggleLanguage(value: string) {
    setLanguageError(undefined);
    setLanguages((current) =>
      current.includes(value) ? current.filter((l) => l !== value) : current.length < MAX_LANGUAGES ? [...current, value] : current,
    );
  }

  function addAvoid(word: string) {
    const clean = word.trim();
    if (clean && !avoid.some((a) => a.toLowerCase() === clean.toLowerCase())) setAvoid((current) => [...current, clean].slice(0, 20));
    setAvoidDraft('');
  }

  function onAvoidKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addAvoid(avoidDraft);
    }
  }

  function onSubmit() {
    const answers: Record<string, unknown> = { ...basics, tone_of_voice: tone || undefined };
    if (avoid.length > 0) answers.topics_to_avoid = avoid;
    const parsed = questionStepSchema('about', track).safeParse(answers);
    const errors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    setFieldErrors(errors);
    if (languages.length === 0) {
      setLanguageError('Pick at least one language');
      return;
    }
    if (Object.keys(errors).length === 0) submit({ ...answers, postLanguages: languages });
  }

  const previewCard = preview ? <VoicePreview brandName={state.brand.name} headline={preview.headline} caption={preview.caption} /> : null;

  return (
    <StepFrame
      step="about"
      title="How should your posts sound?"
      description="Pick a language and a tone. The preview shows an example."
      error={formError}
      saving={saving}
      onSubmit={onSubmit}
      aside={previewCard}
    >
      {toAsk.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-heading font-semibold">{track === 'business' ? 'First, what does your business do?' : 'First, what do you post about?'}</h2>
          {toAsk.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={basics[question.id] ?? ''}
              error={fieldErrors[question.id]}
              onChange={(next) => {
                setBasics((current) => ({ ...current, [question.id]: next }));
                setFieldErrors(({ [question.id]: _cleared, ...rest }) => rest);
              }}
            />
          ))}
        </div>
      ) : null}

      <FieldGroup legend="Post language" helper="Pick up to 3. The first one you pick is your main language." error={languageError}>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((language) => {
            const on = languages.includes(language.value);
            const main = languages[0] === language.value;
            return (
              <button
                key={language.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLanguage(language.value)}
                className={cn(pill, on ? 'bg-ink text-surface' : 'border border-line-strong bg-surface text-ink hover:bg-subtle')}
              >
                {on ? <Check className="size-4" strokeWidth={2.6} aria-hidden="true" /> : null}
                {language.label}
                {main ? <span className="rounded-full bg-highlight px-2 text-caption font-medium text-highlight-on">Main</span> : null}
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup legend="Tone" error={fieldErrors.tone_of_voice}>
        <div className="grid gap-3 md:grid-cols-2">
          {tones.map((option) => (
            <ChoiceCard
              key={option.value}
              size="lg"
              type="radio"
              name="tone"
              value={option.value}
              checked={tone === option.value}
              onChange={() => setTone(option.value)}
              title={option.title}
              description={option.sample}
            />
          ))}
        </div>
      </FieldGroup>

      {previewCard ? <div className="lg:hidden">{previewCard}</div> : null}

      <FieldGroup legend="Never post about (optional)" error={fieldErrors.topics_to_avoid}>
        <div className="flex min-h-touch flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface px-2 py-1 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-canvas">
          {avoid.map((word) => (
            <span key={word} className="inline-flex items-center rounded-full bg-subtle pl-3 text-body">
              {word}
              <button
                type="button"
                onClick={() => setAvoid((current) => current.filter((w) => w !== word))}
                aria-label={`Remove ${word}`}
                className="flex min-h-touch w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            aria-label="Add a word or topic to avoid"
            value={avoidDraft}
            onChange={(event) => setAvoidDraft(event.target.value)}
            onKeyDown={onAvoidKey}
            onBlur={() => addAvoid(avoidDraft)}
            placeholder="Type a word and press Enter"
            className="h-control min-w-0 flex-1 bg-transparent px-2 text-lead outline-none placeholder:text-ink-tertiary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink-tertiary">Common picks:</span>
          {AVOID_SUGGESTIONS.filter((s) => !avoid.includes(s)).map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => addAvoid(word)}
              className="min-h-touch rounded-full border border-dashed border-line-strong px-3 text-body font-medium hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              + {word}
            </button>
          ))}
        </div>
      </FieldGroup>
    </StepFrame>
  );
}
