import { BarChart3, CalendarDays, Check, Send, WandSparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container, SectionHeading } from './section';

const stages: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CalendarDays, title: 'Plan', body: 'Share your link and budget. We map out your month.' },
  { icon: WandSparkles, title: 'Create', body: 'Captions, images and short reels are drafted in your style.' },
  { icon: Check, title: 'Approve', body: 'You review each post and decide what goes out.' },
  { icon: Send, title: 'Publish', body: 'Posts go live on Instagram and Facebook on schedule.' },
  { icon: BarChart3, title: 'Learn', body: 'Results feed next week’s plan, so it keeps improving.' },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-16 border-y border-line bg-surface py-12 md:py-16"
    >
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From a link to a month of posts."
          description="Five steps, and you are only needed for one of them."
        />
        <ol className="mt-8 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-5">
          {stages.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-subtle text-accent">
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span aria-hidden="true" className="hidden h-px flex-1 bg-line lg:block" />
              </div>
              <h3 className="mt-3 font-display text-title">
                <span className="text-ink-tertiary">{index + 1}. </span>
                {title}
              </h3>
              <p className="mt-2 text-body text-ink-secondary">{body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
