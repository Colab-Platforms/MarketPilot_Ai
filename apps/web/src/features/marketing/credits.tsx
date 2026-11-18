import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge, Button } from '@marketpilot/ui';
import { Container, SectionHeading } from './section';

const steps = [
  { title: 'See the cost', body: 'Every AI action shows its credit cost on the button.' },
  { title: 'Confirm', body: 'The confirmation repeats the cost and your remaining balance.' },
  { title: 'Settled when done', body: 'Credits are held first, then settled once the work is delivered.' },
];

export function Credits() {
  return (
    <section
      aria-labelledby="credits-title"
      className="border-y border-line bg-surface py-12 md:py-16"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              id="credits-title"
              eyebrow="Credits"
              title="Know the cost before you click."
              description="You pay with credits for what the AI creates. Plans and prices will be announced before launch."
            />
            <ol className="mt-8 grid list-none gap-4 p-0">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-label text-accent">
                    {index + 1}
                  </span>
                  <p className="text-body text-ink-secondary">
                    <span className="text-ink">{step.title}.</span> {step.body}
                  </p>
                </li>
              ))}
            </ol>
            <Button asChild variant="secondary" className="mt-8">
              <Link href="/register">Get early access</Link>
            </Button>
          </div>

          <figure className="m-0">
            <div aria-hidden="true" inert className="rounded-lg border border-line bg-canvas p-6 shadow-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-heading">Generate 5 captions</p>
                <Badge tone="info">
                  <Sparkles className="size-4" strokeWidth={1.5} />
                  AI
                </Badge>
              </div>
              <p className="mt-2 text-body text-ink-secondary">
                Written in your tone for next week’s Diwali offer.
              </p>
              <dl className="mt-4 grid gap-2 border-t border-line pt-4 text-body">
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">Cost</dt>
                  <dd className="text-ink">1 credit</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">Balance after</dt>
                  <dd className="text-ink">41 credits</dd>
                </div>
              </dl>
              <div className="mt-6 flex gap-2">
                <Button>Generate · 1 credit</Button>
                <Button variant="ghost">Cancel</Button>
              </div>
            </div>
            <figcaption className="mt-3 text-caption text-ink-tertiary">
              Sample confirmation. Credit amounts are illustrative.
            </figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}
