'use client';

import Link from 'next/link';
import { Clapperboard, Download, Library } from 'lucide-react';
import type { ReelProject } from '@marketpilot/contracts';
import { Alert, Badge, Button, Card, Spinner } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { useAssembleReel } from './reel-api';

// The finished video: clips joined and cut to length with on-screen text. Assembling costs
// nothing with a provider, so it needs no confirmation.
export function FinalReelCard({ reel }: { reel: ReelProject }) {
  const assemble = useAssembleReel(reel.id);
  const { render, assembly } = reel;
  const working = render?.status === 'queued' || render?.status === 'running' || assemble.isPending;
  const done = render?.status === 'succeeded' && render.url;
  const needsAssembly = !render || render.status === 'failed' || render.outdated;

  if (!assembly.available) {
    return <Alert tone="info">Assembling reels is not set up on this server yet.</Alert>;
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-label text-ink">Finished reel</h3>
          <p className="text-caption text-ink-secondary">
            Your clips joined in order, each cut to its scene, with the on-screen text added.
            Changing text later only needs a free re-assemble.
          </p>
        </div>
        {done && render.outdated ? <Badge tone="warning">Outdated</Badge> : null}
      </div>

      {working ? (
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <Spinner className="size-4" />
          <span className="text-body text-ink-secondary">
            Putting your reel together. This takes under a minute.
          </span>
        </div>
      ) : null}

      {done && !working ? (
        <div className="flex flex-col items-start gap-3">
          <video
            key={render.id}
            src={render.url ?? undefined}
            aria-label="Your finished reel"
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] h-preview rounded-md bg-subtle"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={render.url ?? undefined} download target="_blank" rel="noreferrer">
                <Download className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Download
              </a>
            </Button>
            {render.assetId ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/library">
                  <Library className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Saved in your library
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {render?.status === 'failed' && !working ? (
        <Alert tone="danger">
          {render.message ?? 'We could not put this reel together. Try again.'}
        </Alert>
      ) : null}

      {assembly.blockedBy && !working ? (
        <p className="text-caption text-ink-secondary">{assembly.blockedBy}.</p>
      ) : null}

      {!working && needsAssembly ? (
        <Button
          className="self-start"
          disabled={assembly.blockedBy !== null}
          onClick={() => assemble.mutate(crypto.randomUUID())}
        >
          <Clapperboard className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {render?.outdated ? 'Assemble again' : 'Assemble reel'}
        </Button>
      ) : null}

      {assemble.isError ? (
        <Alert tone="danger">
          {assemble.error instanceof ApiError
            ? assemble.error.message
            : 'We could not start assembling. Try again.'}
        </Alert>
      ) : null}
    </Card>
  );
}
