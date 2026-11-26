'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@marketpilot/ui';
import { ApproveCard, CreateCard, PlanCard, ResultsCard } from './tour-slides';

const slides: { tab: string; title: string; body: string; Visual: ComponentType<{ compact?: boolean }> }[] = [
  {
    tab: 'Plan',
    title: 'A month of posts, planned for you',
    body: 'Paste your website or Instagram. MarketPilot plans 30 days around festivals, wedding season and your busy days.',
    Visual: PlanCard,
  },
  {
    tab: 'Create',
    title: 'Posts in your voice, in Hindi or English',
    body: 'Captions, posts and short reels made from your own products and offers, ready in minutes.',
    Visual: CreateCard,
  },
  {
    tab: 'Approve',
    title: 'Nothing goes live without your yes',
    body: 'Every post waits for you. Approve, edit or skip from your computer or phone.',
    Visual: ApproveCard,
  },
  {
    tab: 'Results',
    title: 'Results in plain words, every week',
    body: 'A short note on what worked, and next week’s plan changes to match.',
    Visual: ResultsCard,
  },
];

const ROTATE_MS = 4500;

// Rotates through the slides until the visitor picks one. Hovering or focusing pauses it,
// and it never moves for people who ask for reduced motion (DESIGN.md section 10).
export function useTour() {
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (stopped || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [stopped, paused]);

  return {
    index,
    pick: (i: number) => {
      setIndex(i);
      setStopped(true);
    },
    pauseProps: {
      onMouseEnter: () => setPaused(true),
      onMouseLeave: () => setPaused(false),
      onFocus: () => setPaused(true),
      onBlur: () => setPaused(false),
    },
  };
}

export type Tour = ReturnType<typeof useTour>;

export function Hills({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 800 360" preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-x-0 bottom-0 w-full', className)}>
      <path className="mk-hill-1" d="M0 150 C 120 90 230 70 340 110 C 450 150 540 60 660 70 C 730 76 770 100 800 115 L800 360 L0 360Z" />
      <path className="mk-hill-2" d="M0 215 C 140 160 260 150 380 190 C 500 230 600 170 700 160 C 750 156 780 165 800 175 L800 360 L0 360Z" />
      <path className="mk-hill-3" d="M0 280 C 160 235 300 240 430 265 C 560 290 680 250 800 240 L800 360 L0 360Z" />
    </svg>
  );
}

const onDarkFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight';

export function TourPanel({ tour }: { tour: Tour }) {
  const slide = slides[tour.index] ?? slides[0];
  if (!slide) return null;
  const { Visual } = slide;
  return (
    <aside
      aria-label="What MarketPilot does"
      {...tour.pauseProps}
      className="mk-tour-backdrop relative hidden w-1/2 max-w-tour shrink-0 flex-col justify-between gap-6 overflow-hidden rounded-xl p-12 lg:flex"
    >
      <Hills className="h-1/2" />
      <Send aria-hidden="true" className="absolute right-16 top-12 size-6 -rotate-6 opacity-30" strokeWidth={1.6} />
      <div aria-hidden="true" className="relative flex flex-1 items-center justify-center">
        <div key={tour.index} className="mk-slide-in flex w-full justify-center">
          <Visual />
        </div>
      </div>
      <div className="relative flex max-w-xl flex-col gap-3">
        <div role="group" aria-label="Choose a part of the tour" className="flex flex-wrap gap-2">
          {slides.map((s, i) => (
            <button
              key={s.tab}
              type="button"
              aria-pressed={i === tour.index}
              onClick={() => tour.pick(i)}
              className={cn(
                'min-h-touch rounded-full border px-4 text-body font-semibold transition-colors duration-fast ease-standard',
                i === tour.index ? 'border-tile-white bg-tile-white text-tile-ink' : 'border-glass text-tile-white hover:bg-glass',
                onDarkFocus,
              )}
            >
              {s.tab}
            </button>
          ))}
        </div>
        <h2 className="text-balance font-display text-stat font-bold">{slide.title}</h2>
        <p className="text-lead opacity-80">{slide.body}</p>
      </div>
    </aside>
  );
}

// Phone version: a compact card, the slide title and dots that double as slide pickers.
export function TourHeader({ tour }: { tour: Tour }) {
  const slide = slides[tour.index] ?? slides[0];
  if (!slide) return null;
  const { Visual } = slide;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div aria-hidden="true" className="w-full max-w-xs">
        <div key={tour.index} className="mk-slide-in">
          <Visual compact />
        </div>
      </div>
      <p className="max-w-xs text-balance text-heading font-semibold">{slide.title}</p>
      <div role="group" aria-label="Choose a part of the tour" className="flex">
        {slides.map((s, i) => (
          <button
            key={s.tab}
            type="button"
            aria-label={s.tab}
            aria-pressed={i === tour.index}
            onClick={() => tour.pick(i)}
            className={cn('flex min-h-touch items-center rounded-sm px-1', onDarkFocus)}
          >
            <span className={cn('h-1 rounded-full transition-all duration-base ease-standard', i === tour.index ? 'w-8 bg-highlight' : 'w-3 bg-glass')} />
          </button>
        ))}
      </div>
    </div>
  );
}
