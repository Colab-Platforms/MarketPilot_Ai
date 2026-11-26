'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@marketpilot/ui';
import { Container, SectionIntro, focusRing } from './section';

// Mirrors the product's autonomy levels 0-3 (Level 1 is every workspace's default).
const levels = [
  {
    name: 'Assist',
    tag: 'Level 0',
    headline: 'You make it. It helps.',
    body: 'MarketPilot suggests ideas and drafts captions when you ask. You create and post everything yourself.',
    rules: { Plan: 'Ideas when you ask', Posting: 'You post it yourself', Spending: 'Never without you' },
  },
  {
    name: 'Suggest',
    tag: 'Default',
    headline: 'It suggests. You decide.',
    body: 'MarketPilot plans your week and drafts every post. You approve or edit each one before it goes live.',
    rules: { Plan: 'Drafted for you every week', Posting: 'After you approve each post', Spending: 'Never without you' },
  },
  {
    name: 'Approve once',
    tag: 'Level 2',
    headline: 'Approve the week. It does the rest.',
    body: "You approve the week's plan once. Routine posts in it go out on their own, and anything new still waits for you.",
    rules: { Plan: 'You approve it once a week', Posting: 'Routine posts go out on their own', Spending: 'Never without you' },
  },
  {
    name: 'Autopilot',
    tag: 'Level 3',
    headline: 'It runs the plan inside your limits.',
    body: 'MarketPilot plans, creates and publishes within the rules and caps you set, and sends you a note every week.',
    rules: { Plan: 'Made and run for you', Posting: 'Automatic, outside quiet hours', Spending: 'Up to the cap you set' },
  },
];

const guardrails = ['Spend caps', 'Quiet hours', 'Brand rules', 'Undo'];

const trackFill = ['w-0', 'w-1/3', 'w-2/3', 'w-full'];
const markerLeft = ['left-0', 'left-1/3', 'left-2/3', 'left-full'];

export function Controls() {
  const [level, setLevel] = useState(1);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const current = levels[level];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (level + step + levels.length) % levels.length;
    setLevel(next);
    radios.current[next]?.focus();
  }

  if (!current) return null;

  return (
    <section id="controls" aria-labelledby="controls-title" className="scroll-mt-4 border-y border-line bg-surface py-16 md:py-24">
      <Container className="flex flex-col gap-8">
        <SectionIntro
          titleId="controls-title"
          title="From co-pilot to autopilot. Your call."
          description="Every account starts at Suggest. Move up only when you trust it, channel by channel."
        />
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-4 md:p-8">
          <div aria-hidden="true" className="mx-auto hidden w-3/4 md:block">
            <div className="relative h-2 rounded-full bg-subtle">
              <div className={cn('absolute inset-y-0 left-0 rounded-full bg-highlight transition-all duration-slow ease-standard', trackFill[level])} />
              <div
                className={cn(
                  'absolute top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-highlight text-highlight-on ring-8 ring-highlight-subtle transition-all duration-slow ease-standard',
                  markerLeft[level],
                )}
              >
                <Send className="size-4 rotate-45" strokeWidth={2.4} />
              </div>
            </div>
          </div>

          <div role="radiogroup" aria-label="Autonomy level" onKeyDown={onKeyDown} className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {levels.map((l, i) => {
              const checked = i === level;
              return (
                <button
                  key={l.name}
                  ref={(node) => {
                    radios.current[i] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => setLevel(i)}
                  className={cn(
                    'flex min-h-touch flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-3 text-center transition-colors duration-fast ease-standard',
                    checked ? 'border-highlight bg-subtle text-ink' : 'border-transparent text-ink-secondary hover:text-ink',
                    focusRing,
                  )}
                >
                  <span className="font-display text-heading font-bold md:text-title">{l.name}</span>
                  <span className="text-caption">{l.tag}</span>
                </button>
              );
            })}
          </div>

          <div aria-live="polite" className="flex flex-col gap-6 border-t border-line pt-2 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-3 pt-5">
              <h3 className="font-display text-display font-extrabold tracking-tight">{current.headline}</h3>
              <p className="text-lead text-ink-secondary">{current.body}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col pt-3">
              <dl className="m-0">
                {Object.entries(current.rules).map(([area, rule]) => (
                  <div key={area} className="flex gap-4 border-b border-line py-3 text-lead">
                    <dt className="w-24 shrink-0 text-ink-tertiary">{area}</dt>
                    <dd className="m-0 font-semibold">{rule}</dd>
                  </div>
                ))}
              </dl>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0 pt-3 text-label font-semibold text-ink-secondary">
                {guardrails.map((g) => (
                  <li key={g} className="rounded-full bg-subtle px-3 py-1">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
