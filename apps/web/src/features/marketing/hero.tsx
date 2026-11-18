import { ArrowRight } from 'lucide-react';
import { Badge, Button, Input } from '@marketpilot/ui';
import { FlightLog } from './flight-log';
import { Marquee } from './marquee';
import { sampleRows } from './sample-tiles';
import { Container } from './section';

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-canvas pb-12 pt-12 md:pt-16"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Badge tone="accent">Made for India’s local businesses</Badge>
            <h1
              id="hero-title"
              className="mt-4 font-display text-display text-balance md:text-banner lg:text-hero"
            >
              Marketing that takes off while you run the shop.
            </h1>
            <p className="mt-4 max-w-prose text-heading font-normal text-ink-secondary">
              Share your website and a budget. MarketPilot plans your posts, creates them, and
              publishes only after you approve.
            </p>

            <form action="/login" method="get" className="mt-8 max-w-form">
              <label htmlFor="hero-url" className="block text-label text-ink">
                Your website or Instagram page
              </label>
              <div className="mt-2 flex flex-col gap-2 md:flex-row">
                <Input
                  id="hero-url"
                  name="url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://yourshop.in"
                />
                <Button type="submit" className="md:shrink-0">
                  Create my plan
                  <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </Button>
              </div>
              <p className="mt-2 text-caption text-ink-tertiary">
                Nothing is posted without your approval.
              </p>
            </form>
          </div>

          <div className="lg:col-span-5">
            <FlightLog />
          </div>
        </div>
      </Container>

      <div className="mt-12">
        <Marquee rows={sampleRows} />
      </div>
    </section>
  );
}
