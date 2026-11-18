'use client';

import Link from 'next/link';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { Button, Card, ProgressRing, Skeleton } from '@marketpilot/ui';
import { useProfile } from '@/features/profile/profile-api';

const SHOWN_GAPS = 4;

// The first thing on Home: how much the AI knows about the business, and the gaps worth filling.
export function ProfileCompletionBanner() {
  const query = useProfile();

  if (query.isPending) return <Skeleton className="h-tile w-full md:h-32" />;
  if (query.isError || !query.data) return null;

  const { completeness, sections } = query.data;
  const percent = completeness.total > 0 ? Math.round((completeness.filled / completeness.total) * 100) : 0;
  const gaps = sections
    .filter((s) => !s.skipped && s.total > 0 && s.filled < s.total)
    .sort((a, b) => a.filled / a.total - b.filled / b.total)
    .slice(0, SHOWN_GAPS);
  const complete = gaps.length === 0;

  return (
    <Card className="flex flex-col gap-5 border-accent-line bg-accent-subtle md:flex-row md:items-center">
      <ProgressRing percent={percent} label="Brand profile completeness" className="size-16" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h2 className="text-heading text-ink">
            {complete ? 'Your brand profile is complete' : `Your brand profile is ${percent}% complete`}
          </h2>
          <p className="mt-1 text-caption text-ink-secondary">
            {complete
              ? 'Every post we draft can now sound like you. Keep it current as things change.'
              : `${completeness.filled} of ${completeness.total} details filled. The more we know, the more your posts sound like you.`}
          </p>
        </div>
        {complete ? null : (
          <ul className="flex flex-wrap gap-2" aria-label="Sections to finish">
            {gaps.map((section) => (
              <li key={section.id}>
                <Link
                  href={`/brand#${section.id}`}
                  className="inline-flex h-control-sm items-center gap-2 rounded-full border border-accent-line bg-surface px-3 text-caption text-ink transition-colors duration-fast ease-standard hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {section.title}
                  <span className="tabular-nums text-ink-tertiary">
                    {section.filled}/{section.total}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button asChild variant={complete ? 'secondary' : 'primary'} className="shrink-0 self-start md:self-center">
        <Link href="/brand">
          {complete ? <CircleCheck className="size-4" strokeWidth={1.5} aria-hidden="true" /> : null}
          {complete ? 'Review profile' : 'Complete profile'}
          {complete ? null : <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />}
        </Link>
      </Button>
    </Card>
  );
}
