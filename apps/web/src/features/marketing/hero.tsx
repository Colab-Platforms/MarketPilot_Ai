import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { ApprovalCard, LearntCard } from './hero-cards';
import { HeroDashboard } from './hero-dashboard';
import { HeroPhone } from './hero-phone';
import { Container, Marker } from './section';

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="mk-hero-backdrop pb-12 pt-6">
      <Container className="flex flex-col items-center gap-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-body font-medium text-ink-secondary">
          <span className="rounded-full bg-highlight px-2 py-0.5 text-caption font-bold text-highlight-on">Early access</span>
          Made for India&apos;s local businesses
        </span>
        <h1 id="hero-title" className="max-w-page text-balance font-display text-hero">
          Marketing that <Marker>takes off</Marker> while you run the shop.
        </h1>
        
        <p className="max-w-prose text-lead text-ink-secondary md:text-lead-lg">
          MarketPilot plans a month of posts, makes them in your brand&apos;s voice, and publishes only after you say yes.
        </p>
        <div className="flex w-full flex-col justify-center gap-3 md:w-auto md:flex-row">
          <Button asChild size="xl">
            <Link href="/register">
              Get started
              <ArrowRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="xl" variant="secondary" className="font-semibold">
            <a href="#how">See how it works</a>
          </Button>
        </div>
      </Container>

      <Container className="mt-12">
        <figure className="m-0">
          <div aria-hidden="true" inert>
            <div className="hidden items-start gap-6 md:flex">
              <HeroDashboard className="min-w-0 flex-1" />
              <div className="hidden w-aside shrink-0 flex-col items-center gap-6 xl:flex">
                <LearntCard className="w-full" />
                <HeroPhone />
              </div>
            </div>
            <div className="mx-auto flex max-w-form flex-col gap-4 md:hidden">
              <LearntCard />
              <ApprovalCard className="shadow-card" />
            </div>
          </div>
          <figcaption className="mt-4 text-center text-caption text-ink-tertiary">
            Sample workspace for an example sweet shop.
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
