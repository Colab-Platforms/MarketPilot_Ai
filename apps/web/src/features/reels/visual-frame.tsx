'use client';

import Image from 'next/image';
import { Film, ImageIcon, RefreshCw } from 'lucide-react';
import type { ReelVisual } from '@marketpilot/contracts';
import { Badge, Button, Spinner, cn } from '@marketpilot/ui';

const ASPECT = { portrait: 'aspect-[4/5]', story: 'aspect-[9/16]' } as const;

interface VisualFrameProps {
  visual: ReelVisual | undefined;
  shape: keyof typeof ASPECT;
  alt: string;
  // Null when this picture cannot be drawn yet (no portraits, or the reel is busy).
  onRedraw: (() => void) | null;
  redrawing: boolean;
  onSelect: (takeId: string) => void;
  media?: 'image' | 'video';
}

const WORDS = {
  image: { empty: 'Not drawn yet', working: 'Drawing', make: 'Draw', remake: 'Redraw' },
  video: { empty: 'Not rendered yet', working: 'Rendering', make: 'Render', remake: 'Re-render' },
} as const;

export function VisualFrame({
  visual,
  shape,
  alt,
  onRedraw,
  redrawing,
  onSelect,
  media = 'image',
}: VisualFrameProps) {
  const current = visual?.current ?? null;
  const drawing = (visual?.drawing ?? false) || redrawing;
  const earlier = visual?.takes ?? [];
  const words = WORDS[media];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-line bg-subtle',
          ASPECT[shape],
        )}
      >
        {current && media === 'video' ? (
          <video
            key={current.id}
            src={current.url}
            aria-label={alt}
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : current ? (
          <Image src={current.url} alt={alt} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            {media === 'video' ? (
              <Film className="size-5 text-ink-tertiary" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ImageIcon
                className="size-5 text-ink-tertiary"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
            {!drawing ? (
              <span className="text-caption text-ink-tertiary">{words.empty}</span>
            ) : null}
          </div>
        )}
        {current && visual?.outdated && !drawing ? (
          <Badge tone="warning" className="absolute left-2 top-2">
            Outdated
          </Badge>
        ) : null}
        {drawing ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1"
            role="status"
            aria-live="polite"
          >
            <div className="absolute inset-0 bg-surface opacity-70" aria-hidden="true" />
            <Spinner className="relative size-4" />
            <span className="relative text-caption text-ink">{words.working}</span>
          </div>
        ) : null}
      </div>

      {visual?.failure && !drawing ? (
        <p className="text-caption text-danger">{visual.failure}</p>
      ) : null}

      {earlier.length > 1 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Earlier versions">
          {earlier.map((take, i) => {
            const selected = take.id === current?.id;
            return (
              <li key={take.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Use version ${earlier.length - i}`}
                  onClick={() => !selected && onSelect(take.id)}
                  className={cn(
                    'relative flex h-control-sm w-control-sm items-center justify-center overflow-hidden rounded-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selected ? 'border-accent ring-1 ring-accent' : 'border-line',
                  )}
                >
                  {media === 'video' ? (
                    <span className="text-caption text-ink">{earlier.length - i}</span>
                  ) : (
                    <Image src={take.url} alt="" fill unoptimized className="object-cover" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {onRedraw ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={drawing}
          onClick={onRedraw}
        >
          <RefreshCw className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {current ? words.remake : words.make}
        </Button>
      ) : null}
    </div>
  );
}
