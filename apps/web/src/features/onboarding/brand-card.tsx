import { BUSINESS_CATEGORIES, CHANNELS, LANGUAGES, OBJECTIVES, TONES, type OnboardingState } from '@marketpilot/contracts';
import { Progress } from '@marketpilot/ui';
import { BUY_OPTIONS, buysFrom } from './setup-copy';

const labelOf = (options: readonly { value: string; label: string }[], value: unknown) =>
  typeof value === 'string' ? options.find((o) => o.value === value)?.label : undefined;

function hostOf(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

type Answers = Record<string, Record<string, unknown> | undefined>;

// What setup knows about the brand so far, so the owner can see it fill in.
export function BrandCard({ state }: { state: OnboardingState }) {
  const answers = state.answers as Answers;
  const basics = answers.basics ?? {};
  const about = answers.about ?? {};
  const goals = answers.goals ?? {};
  const isBusiness = state.track === 'business';
  const named = state.completedSteps.includes('basics');

  const category = labelOf(BUSINESS_CATEGORIES, about.business_category ?? state.known.category);
  const sub = [isBusiness ? category : (about.creator_niche as string | undefined) ?? state.known.niche, state.brand.city]
    .filter(Boolean)
    .join(' · ');
  const buys = buysFrom(basics.salesChannels as string[] | undefined);
  const languages = (about.postLanguages as string[] | undefined) ?? (state.completedSteps.includes('about') ? [state.brand.language] : []);
  const channels = (goals.preferred_channels as string[] | undefined) ?? [];

  const rows = [
    { label: 'Website', value: named ? (hostOf(state.brand.websiteUrl) ?? 'None yet') : undefined },
    ...(isBusiness
      ? [{ label: 'Sells', value: BUY_OPTIONS.filter((o) => buys.includes(o.id)).map((o) => o.short).join(', ') || undefined }]
      : []),
    { label: 'Voice', value: labelOf(TONES, about.tone_of_voice ?? state.known.toneOfVoice) },
    { label: 'Languages', value: languages.map((l) => labelOf(LANGUAGES, l)).filter(Boolean).join(', ') || undefined },
    { label: 'Goal', value: labelOf(OBJECTIVES, goals.primary_objective ?? state.known.primaryObjective) },
    { label: 'Posting on', value: channels.map((c) => labelOf(CHANNELS, c)).filter(Boolean).join(', ') || undefined },
  ];
  const done = state.completedSteps.filter((s) => state.steps.includes(s)).length;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="mk-tour-backdrop h-16" />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <span className="-mt-8 flex size-16 items-center justify-center rounded-lg border-4 border-surface bg-tile-ink font-display text-title font-bold text-highlight">
          {named ? initialsOf(state.brand.name) : '?'}
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-title font-semibold">{named ? state.brand.name : isBusiness ? 'Your brand card' : 'Your creator card'}</span>
          <span className="text-body text-ink-tertiary">
            {named ? sub || 'Details fill in as you go' : 'It fills in as we learn about you, so you can see what we know.'}
          </span>
        </div>
        <dl className="m-0 flex flex-col">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 border-t border-line py-3 text-body">
              <dt className="text-ink-tertiary">{row.label}</dt>
              {row.value ? (
                <dd className="m-0 text-right font-semibold">{row.value}</dd>
              ) : (
                <dd className="m-0 h-3 w-24 rounded-sm bg-subtle" aria-label="Not added yet" />
              )}
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <span className="flex justify-between text-body">
            <span className="text-ink-tertiary">Setup</span>
            <span className="font-semibold tabular-nums">
              {done} of {state.steps.length} steps
            </span>
          </span>
          <Progress value={done} max={state.steps.length} label="Setup progress" className="h-2 bg-subtle" />
        </div>
      </div>
    </div>
  );
}
