'use client';

import Image from 'next/image';
import { CircleAlert, CircleCheck, ExternalLink, RotateCcw } from 'lucide-react';
import { IMAGE_DESIGNS, IMAGE_FORMATS, type ImageFormat, type ImageGeneration } from '@marketpilot/contracts';
import { Alert, Badge, Button, Card, Skeleton, Spinner, cn } from '@marketpilot/ui';
import { FeedbackBar } from '@/features/library/feedback-bar';
import { isActive } from './studio-api';

// Each format's real ratio, so a tile has height before and after its image loads. Written as
// full class names so Tailwind finds them in this file.
export const ASPECT: Record<ImageFormat, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  story: 'aspect-[9/16]',
};
const FORMAT_LABELS = new Map(IMAGE_FORMATS.map((f) => [f.value, f.label]));
const DESIGN_LABELS = new Map(IMAGE_DESIGNS.map((d) => [d.value, d.label]));

export function StatusChip({ generation }: { generation: ImageGeneration }) {
  if (isActive(generation)) {
    return (
      <Badge tone="info">
        <Spinner className="size-3" />
        Creating
      </Badge>
    );
  }
  if (generation.status === 'succeeded') {
    return (
      <Badge tone="success">
        <CircleCheck className="size-3" strokeWidth={1.5} aria-hidden="true" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge tone="danger">
      <CircleAlert className="size-3" strokeWidth={1.5} aria-hidden="true" />
      Failed
    </Badge>
  );
}

const timeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

interface GenerationCardProps {
  generation: ImageGeneration;
  onRetry: (generation: ImageGeneration) => void;
  retrying: boolean;
}

export function GenerationCard({ generation, onRetry, retrying }: GenerationCardProps) {
  const active = isActive(generation);
  const aspect = ASPECT[generation.format];
  const meta = [
    DESIGN_LABELS.get(generation.design),
    FORMAT_LABELS.get(generation.format),
    generation.productName,
    generation.headline ? `Text: “${generation.headline}”` : null,
    timeFormat.format(new Date(generation.createdAt)),
  ].filter(Boolean);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-label text-ink">{generation.brief}</p>
          <p className="text-caption text-ink-secondary">{meta.join(' · ')}</p>
        </div>
        <StatusChip generation={generation} />
      </div>

      {active ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <span className="text-caption text-ink-secondary">
            Creating {generation.variants} {generation.variants === 1 ? 'image' : 'images'}. This usually takes under a minute.
          </span>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: generation.variants }, (_, i) => (
              <Skeleton key={i} className={cn('w-full', aspect)} />
            ))}
          </div>
        </div>
      ) : null}

      {generation.images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Generated images">
          {generation.images.map((image, i) => (
            <li key={image.id} className="flex flex-col gap-1">
              <div className={cn('relative w-full overflow-hidden rounded-md border border-line bg-subtle', aspect)}>
                <Image
                  src={image.url}
                  alt={`Option ${i + 1}: ${generation.brief}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <Badge className="absolute left-2 top-2">AI draft</Badge>
              </div>
              <a
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-touch items-center gap-1 self-start text-caption text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0"
              >
                <ExternalLink className="size-3" strokeWidth={1.5} aria-hidden="true" />
                Open full size
                <span className="sr-only">(option {i + 1}, opens in a new tab)</span>
              </a>
              {image.assetId ? (
                <FeedbackBar
                  compact
                  rateable
                  assetId={image.assetId}
                  styleReference={image.styleReference}
                  feedback={image.feedback}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!active && generation.message ? (
        <Alert tone={generation.images.length > 0 ? 'info' : 'danger'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{generation.message}</span>
            <Button variant="secondary" size="sm" loading={retrying} onClick={() => onRetry(generation)}>
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}
    </Card>
  );
}
