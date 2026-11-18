import { Coins, ShieldCheck, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, cn } from '@marketpilot/ui';
import { Container, SectionHeading } from './section';

const levels = [
  {
    name: 'You approve every post',
    body: 'Nothing goes out until you say so. Everyone starts here.',
    isDefault: true,
  },
  {
    name: 'Routine posts go out on their own',
    body: 'Once you trust the drafts, safe and regular posts can publish themselves.',
    isDefault: false,
  },
  {
    name: 'Autopilot within your limits',
    body: 'Set your budget and rules. We run the plan and report back.',
    isDefault: false,
  },
];

const promises: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Coins,
    title: 'No cost surprises',
    body: 'Every AI action shows what it will do and what it costs before it runs.',
  },
  {
    icon: Undo2,
    title: 'Easy to undo',
    body: 'After each change you see what happened and how to reverse it.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety checks',
    body: 'Risky claims, like guaranteed results, are flagged and blocked from scheduling at every level.',
  },
];

export function Control() {
  return (
    <section
      id="control"
      aria-labelledby="control-title"
      className="scroll-mt-16 border-b border-line bg-subtle py-12 md:py-16"
    >
      <Container>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              id="control-title"
              eyebrow="Your controls"
              title="You decide how much to hand over."
              description="Start by approving everything. Give MarketPilot more freedom only when you are ready, per channel, and take it back any time."
            />
            <ul className="mt-8 grid list-none gap-6 p-0">
              {promises.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden="true" />
                  <p className="text-body text-ink-secondary">
                    <span className="text-ink">{title}.</span> {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <ol className="relative m-0 grid list-none gap-4 p-0">
            {levels.map((level, index) => (
              <li
                key={level.name}
                className={cn(
                  'flex gap-4 rounded-md border p-4 md:p-6',
                  level.isDefault ? 'border-accent-line bg-accent-subtle' : 'border-line bg-surface',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-label',
                    level.isDefault ? 'border-accent bg-accent text-accent-on' : 'border-line-strong text-ink-secondary',
                  )}
                >
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-heading">{level.name}</h3>
                    {level.isDefault ? <Badge tone="accent">Default</Badge> : null}
                  </div>
                  <p className="mt-2 text-body text-ink-secondary">{level.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
