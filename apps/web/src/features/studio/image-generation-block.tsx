'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ImageGenerationBlock } from '@marketpilot/contracts';
import { Badge, Skeleton, cn } from '@marketpilot/ui';
import { FeedbackBar } from '@/features/library/feedback-bar';
import { ASPECT, StatusChip } from './generation-card';
import { isActive, useImageGeneration } from './studio-api';

// Images the copilot started, followed live from the studio API.
export function ImageGenerationBlockView({ block }: { block: ImageGenerationBlock }) {
  const query = useImageGeneration(block.generationId);
  const aspect = ASPECT[block.format];
  const generation = query.data;

  return (
    <section aria-label="Images" className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label text-ink">Images</span>
        {generation ? <StatusChip generation={generation} /> : null}
      </div>

      {query.isError ? (
        <p className="text-caption text-ink-secondary">
          We could not check on these images.{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      ) : !generation || isActive(generation) ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <span className="text-caption text-ink-secondary">Creating your images. This usually takes under a minute.</span>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: block.variants }, (_, i) => (
              <Skeleton key={i} className={cn('w-full', aspect)} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {generation.images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2" aria-label="Generated images">
              {generation.images.map((image, i) => (
                <li key={image.id} className="flex flex-col gap-1">
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'relative block w-full overflow-hidden rounded-sm border border-line bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      aspect,
                    )}
                  >
                    <Image src={image.url} alt={`Option ${i + 1}: ${generation.brief}`} fill unoptimized className="object-cover" />
                    <Badge className="absolute left-1 top-1">AI draft</Badge>
                    <span className="sr-only">(opens full size in a new tab)</span>
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
          {generation.message ? <p className="text-caption text-ink-secondary">{generation.message}</p> : null}
        </>
      )}

      <Link
        href="/create"
        className="inline-flex min-h-touch items-center gap-1 self-start text-caption text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0"
      >
        See all on the Create page
        <ArrowRight className="size-3" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </section>
  );
}
