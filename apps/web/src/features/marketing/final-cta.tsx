import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { Container } from './section';

function PreviewStack() {
  return (
    <div aria-hidden="true" className="relative hidden h-tile w-full max-w-form shrink-0 xl:block">
      <div className="mk-tile-ink mk-pattern-lg absolute left-0 top-8 h-tile w-tile -rotate-6 rounded-xl p-4 shadow-window">
        <span className="rounded-full bg-glass px-3 py-1 text-caption font-bold">Reel</span>
      </div>
      <div className="mk-tile-navy mk-pattern-lg absolute left-1/4 top-0 h-tile w-tile rotate-3 rounded-xl p-4 shadow-window">
        <span className="rounded-full bg-glass px-3 py-1 text-caption font-bold">Post</span>
      </div>
      <div className="absolute left-1/2 top-12 flex h-tile w-tile rotate-6 flex-col justify-between rounded-xl bg-tile-white p-4 text-tile-ink shadow-window">
        <span className="self-start rounded-full bg-highlight px-3 py-1 text-caption font-bold text-highlight-on">Needs you</span>
        <span className="font-display text-title font-extrabold leading-tight">Wedding boxes from ₹499</span>
        <span className="rounded-lg bg-tile-navy py-2 text-center text-body font-bold text-tile-white">Approve</span>
      </div>
    </div>
  );
}

const onBandFocus = 'focus-visible:ring-tile-white focus-visible:ring-offset-band';

export function FinalCta() {
  return (
    <section id="start" aria-labelledby="start-title" className="overflow-hidden bg-band py-16 text-tile-white md:py-24">
      <Container className="flex flex-col items-start gap-12 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-6">
          <h2 id="start-title" className="text-balance font-display text-banner">
            Your next post is already being planned.
          </h2>
          <p className="max-w-prose text-lead-lg">
            Share your website or Instagram, get a 7-day plan in under 30 minutes, and approve only what you like.
          </p>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <Button asChild size="xl" className={`bg-highlight text-highlight-on hover:bg-highlight-marker ${onBandFocus}`}>
              <Link href="/register">
                Get started
                <ArrowRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="xl" className={`bg-glass text-tile-white hover:bg-tile-navy ${onBandFocus}`}>
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </div>
        <PreviewStack />
      </Container>
    </section>
  );
}
