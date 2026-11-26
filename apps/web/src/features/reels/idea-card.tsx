'use client';

import { CircleCheck, TrendingUp } from 'lucide-react';
import type { ReelIdea } from '@marketpilot/contracts';
import { Badge, Button, Card } from '@marketpilot/ui';

interface IdeaCardProps {
  idea: ReelIdea;
  chosen: boolean;
  // Null while the reel is busy, so no second step can start.
  onChoose: (() => void) | null;
  choosing: boolean;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-ink-tertiary">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}

export function IdeaCard({ idea, chosen, onChoose, choosing }: IdeaCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-heading">{idea.title}</h3>
          <span className="text-caption text-ink-secondary">
            {idea.format} · {idea.sceneCount} scenes · {idea.musicMood}
          </span>
        </div>
        {chosen ? (
          <Badge tone="success">
            <CircleCheck className="size-3" strokeWidth={1.5} aria-hidden="true" />
            In use
          </Badge>
        ) : null}
      </div>

      <dl className="flex flex-col gap-3">
        <Detail label="Hook (first 2 seconds)">{idea.hook}</Detail>
        <Detail label="Story">{idea.story}</Detail>
        <Detail label="On screen">{idea.persona}</Detail>
        <Detail label="Call to action">{idea.cta}</Detail>
      </dl>

      {idea.trend ? (
        <div className="flex gap-2 rounded-md bg-accent-subtle px-3 py-2">
          <TrendingUp
            className="mt-0.5 size-4 shrink-0 text-accent"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-caption text-ink">
            <span className="text-label">Rides: {idea.trend.name}.</span> {idea.trend.why}
          </p>
        </div>
      ) : null}

      {!chosen ? (
        <Button
          variant="secondary"
          className="self-start"
          loading={choosing}
          disabled={!onChoose}
          onClick={() => onChoose?.()}
        >
          Use this idea
        </Button>
      ) : null}
    </Card>
  );
}
