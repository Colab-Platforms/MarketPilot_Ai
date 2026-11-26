'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@marketpilot/ui';
import { AppWindow } from './app-window';
import { ApprovePanel, CreatePanel, LearnPanel, PlanPanel, PublishPanel } from './how-it-works-panels';
import { Container, Marker, SectionIntro, focusRing } from './section';

const steps = [
  {
    name: 'Plan',
    yours: false,
    nav: 'Plan',
    path: 'plan',
    body: 'Every week it drafts a plan around your products, your offers and the festivals your customers care about.',
    Panel: PlanPanel,
  },
  {
    name: 'Create',
    yours: false,
    nav: 'Studio',
    path: 'studio',
    body: "Captions, images and short reels, made in your brand's voice in Hindi, English or both.",
    Panel: CreatePanel,
  },
  {
    name: 'Approve',
    yours: true,
    nav: 'Approvals',
    path: 'approvals',
    body: 'Look through the week in a few minutes. Approve, edit or ask for a change. Nothing goes out without your yes.',
    Panel: ApprovePanel,
  },
  {
    name: 'Publish',
    yours: false,
    nav: 'Calendar',
    path: 'calendar',
    body: 'Approved posts go live on Instagram and Facebook when your customers are most likely to be online.',
    Panel: PublishPanel,
  },
  {
    name: 'Learn',
    yours: false,
    nav: 'Results',
    path: 'results',
    body: "It reads the results, keeps what worked and adjusts next week's plan.",
    Panel: LearnPanel,
  },
];

const nav = ['Home', 'Plan', 'Studio', 'Approvals', 'Calendar', 'Results'];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = steps[active] ?? steps[0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -active, End: steps.length - 1 - active };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = (active + move + steps.length) % steps.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  if (!step) return null;
  const { Panel } = step;

  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 bg-canvas py-16 md:py-24">
      <Container className="flex flex-col gap-8">
        <SectionIntro
          titleId="how-title"
          title={
            <>
              Five steps a week. <Marker>You do one.</Marker>
            </>
          }
          description="One workspace for the whole loop, on your computer or your phone. Check in once a day, or once a week."
        />

        <div
          role="tablist"
          aria-label="Steps"
          onKeyDown={onKeyDown}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-5 lg:px-0"
        >
          {steps.map((s, i) => {
            const selected = i === active;
            return (
              <button
                key={s.name}
                ref={(node) => {
                  tabs.current[i] = node;
                }}
                id={`step-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="step-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  'flex min-h-touch shrink-0 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-base ease-standard',
                  selected ? 'border-line bg-surface text-ink' : 'border-transparent text-ink-secondary hover:text-ink',
                  focusRing,
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md font-display text-body font-extrabold',
                    selected ? 'bg-highlight text-highlight-on' : s.yours ? 'text-ink ring-2 ring-inset ring-highlight' : 'bg-subtle',
                  )}
                >
                  {i + 1}
                </span>
                <span className="font-display text-title font-bold">{s.name}</span>
                {s.yours ? <span className="text-label font-semibold text-accent">· you</span> : null}
              </button>
            );
          })}
        </div>

        <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${active}`} className="flex flex-col gap-4">
          <p className="text-lead text-ink-secondary lg:sr-only">{step.body}</p>
          <figure className="m-0">
            <div aria-hidden="true" inert>
              <AppWindow url={`app.marketpilot.in/${step.path}`} nav={nav} activeNav={step.nav} className="shadow-card">
                <div className="hidden max-w-content flex-col gap-1 lg:flex">
                  <span className="flex items-center gap-3">
                    <span className="font-display text-title font-extrabold tracking-tight">{step.name}</span>
                    <span className="rounded-full bg-subtle px-2 py-0.5 text-caption font-bold text-ink-secondary">
                      {step.yours ? 'You do this' : 'MarketPilot does this'}
                    </span>
                  </span>
                  <span className="text-body text-ink-secondary">{step.body}</span>
                </div>
                <Panel />
              </AppWindow>
            </div>
            <figcaption className="sr-only">Sample {step.name.toLowerCase()} screen for an example sweet shop.</figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}
