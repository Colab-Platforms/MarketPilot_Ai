'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/features/marketing/logo';
import { Hills, TourHeader, TourPanel, useTour } from './product-tour';

const homeLink =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

// Sign-in and sign-up frame from the approved onboarding design: tour on the left (desktop) or on
// top (phones), the form on a sheet that slides over it.
export function EntryShell({ children }: { children: ReactNode }) {
  const tour = useTour();
  return (
    <div className="flex min-h-screen bg-canvas lg:p-4 lg:pr-0">
      <TourPanel tour={tour} />

      <div className="flex min-w-0 flex-1 flex-col lg:px-12 lg:py-4">
        <header className="hidden items-center justify-between gap-4 lg:flex">
          <Link href="/" aria-label="MarketPilot home" className={homeLink}>
            <Logo />
          </Link>
          <ThemeToggle className="size-12 rounded-full border border-line bg-surface" />
        </header>

        <div className="mk-tour-backdrop relative overflow-hidden px-5 pb-12 pt-4 lg:hidden" {...tour.pauseProps}>
          <Hills className="h-1/2" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" aria-label="MarketPilot home" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
                <Logo />
              </Link>
              <ThemeToggle className="size-12 rounded-full border border-glass text-tile-white hover:bg-glass hover:text-tile-white" />
            </div>
            <TourHeader tour={tour} />
          </div>
        </div>

        <main className="relative -mt-6 flex flex-1 justify-center rounded-t-2xl bg-canvas px-5 py-8 lg:mt-0 lg:items-center lg:rounded-none lg:p-0">
          <div className="w-full max-w-form">{children}</div>
        </main>
      </div>
    </div>
  );
}
