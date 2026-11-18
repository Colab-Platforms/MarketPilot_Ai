import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { Container } from './section';

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="bg-subtle py-16 text-center"
    >
      <Container>
        <h2 id="cta-title" className="mx-auto max-w-content font-display text-display text-balance md:text-banner">
          Your next post is already being planned.
        </h2>
        <p className="mx-auto mt-4 max-w-prose text-heading font-normal text-ink-secondary">
          Start with a link. Review everything before it goes live.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2 md:flex-row">
          <Button asChild size="lg">
            <Link href="/register">
              Get started
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
      </Container>
    </section>
  );
}
