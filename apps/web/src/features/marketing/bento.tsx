import type { ReactNode } from 'react';
import { cn } from '@marketpilot/ui';
import {
  ApproveVisual,
  BrainVisual,
  CreateVisual,
  LearnVisual,
  PlanVisual,
  PublishVisual,
} from './bento-visuals';
import { Container, SectionHeading } from './section';

interface BentoCardProps {
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
}

function BentoCard({ title, body, visual, className }: BentoCardProps) {
  return (
    <article className={cn('flex flex-col overflow-hidden rounded-lg border border-line bg-surface', className)}>
      <div className="flex-1 border-b border-line bg-subtle p-4 md:p-6">{visual}</div>
      <div className="p-4 md:p-6">
        <h3 className="font-display text-title">{title}</h3>
        <p className="mt-2 text-body text-ink-secondary">{body}</p>
      </div>
    </article>
  );
}

export function Bento() {
  return (
    <section id="what-it-does" aria-labelledby="bento-title" className="scroll-mt-16 py-12 md:py-16">
      <Container>
        <SectionHeading
          id="bento-title"
          eyebrow="What it does"
          title="One workspace for the whole marketing loop."
          description="Plan, create, approve, publish and learn, without hiring an agency or learning a new tool for each step."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <BentoCard
            className="md:col-span-2 lg:col-span-4"
            title="A plan you can actually see"
            body="A month of posts laid out on a calendar. Move things, fill gaps, and see what goes out next."
            visual={<PlanVisual />}
          />
          <BentoCard
            className="lg:col-span-2"
            title="Nothing goes out unseen"
            body="Check each post as it will look, then approve, edit or reject."
            visual={<ApproveVisual />}
          />
          <BentoCard
            className="lg:col-span-2"
            title="Content in your voice"
            body="Captions, images and short reels, with the cost shown before you run anything."
            visual={<CreateVisual />}
          />
          <BentoCard
            className="lg:col-span-2"
            title="Posts that really land"
            body="Publishes on schedule, then checks that each post is live."
            visual={<PublishVisual />}
          />
          <BentoCard
            className="lg:col-span-2"
            title="Results in plain words"
            body="See how many people you reached and what to try next."
            visual={<LearnVisual />}
          />
          <BentoCard
            className="md:col-span-2 lg:col-span-6"
            title="It remembers your business"
            body="Your products, offers, tone and festivals stay in one place, so every post sounds like you and avoids claims you would never make."
            visual={<BrainVisual />}
          />
        </div>
      </Container>
    </section>
  );
}
