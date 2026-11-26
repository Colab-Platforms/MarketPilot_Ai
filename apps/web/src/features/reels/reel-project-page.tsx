'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { REEL_GOALS, REEL_LANGUAGES, type ReelProject } from '@marketpilot/contracts';
import { Alert, Skeleton } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { IdeasSection } from './ideas-section';
import { ReelStatusChip } from './reel-status-chip';
import { StoryboardSection } from './storyboard-section';
import { useReel } from './reel-api';

const GOAL_LABELS = new Map<string, string>(REEL_GOALS.map((g) => [g.value, g.label]));
const LANGUAGE_LABELS = new Map<string, string>(REEL_LANGUAGES.map((l) => [l.value, l.label]));

function BackLink() {
  return (
    <Link
      href="/create/reels"
      className="inline-flex items-center gap-1 self-start text-label text-ink-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
      All reels
    </Link>
  );
}

function Header({ reel }: { reel: ReelProject }) {
  const chosen = reel.ideas.find((i) => i.id === reel.chosenIdeaId);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-title">{chosen?.title ?? `Reel for ${reel.productName}`}</h1>
        <p className="text-ink-secondary">
          {reel.productName} · {GOAL_LABELS.get(reel.goal)} · {reel.lengthSeconds} seconds ·{' '}
          {LANGUAGE_LABELS.get(reel.language)}
        </p>
      </div>
      <ReelStatusChip status={reel.status} />
    </div>
  );
}

export function ReelProjectPage({ id }: { id: string }) {
  const reel = useReel(id);

  if (reel.isPending) {
    return (
      <div
        className="mx-auto flex w-full max-w-page flex-col gap-6"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading the reel</span>
        <Skeleton className="h-control w-1/2" />
        <Skeleton className="h-tile w-full" />
      </div>
    );
  }

  if (reel.isError) {
    const missing = reel.error instanceof ApiError && reel.error.status === 404;
    return (
      <div className="mx-auto flex w-full max-w-page flex-col gap-4">
        <BackLink />
        <Alert tone="danger">
          {missing ? 'This reel does not exist or was removed.' : 'We could not load this reel. '}
          {missing ? null : (
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void reel.refetch()}
            >
              Try again
            </button>
          )}
        </Alert>
      </div>
    );
  }

  const data = reel.data;
  const hasStoryboard = data.chosenIdeaId !== null || data.status === 'storyboarding';

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink />
        <Header reel={data} />
        {data.message ? <Alert tone="info">{data.message}</Alert> : null}
      </div>

      {hasStoryboard ? (
        <section aria-labelledby="storyboard" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="storyboard" className="text-heading">
              Storyboard
            </h2>
            <p className="text-caption text-ink-secondary">
              Edit anything for free. Each scene becomes one image and one short clip in the next
              step.
            </p>
          </div>
          <StoryboardSection reel={data} />
        </section>
      ) : null}

      <section aria-labelledby="ideas" className="flex flex-col gap-4">
        <h2 id="ideas" className="text-heading">
          {hasStoryboard ? 'Other ideas' : 'Pick an idea'}
        </h2>
        <IdeasSection reel={data} />
      </section>
    </div>
  );
}
