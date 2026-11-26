'use client';

import { useState } from 'react';
import { Clapperboard, Film, Images, Users } from 'lucide-react';
import type { ReelProject, ReelVisual, ReelVisualKind } from '@marketpilot/contracts';
import { Alert, Button, Card, ConfirmDialog } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { AnimaticPlayer } from './animatic-player';
import { useDrawVisuals } from './reel-api';

const needsDrawing = (v: ReelVisual) => !v.drawing && (v.current === null || v.outdated);
const dollars = (amount: number) => `about $${amount.toFixed(2)}`;
const isReady = (v: ReelVisual) => v.current !== null && !v.outdated && !v.drawing;

// Keyframes follow the portraits, so a person looks the same in every scene.
export function portraitsReady(reel: ReelProject): boolean {
  return reel.visuals.portraits.every((p) => p.current !== null && !p.drawing);
}

export function PicturesBar({ reel }: { reel: ReelProject }) {
  const draw = useDrawVisuals(reel.id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmRender, setConfirmRender] = useState(false);
  const { visuals } = reel;
  const portraitsToDraw = visuals.portraits.filter(needsDrawing).length;
  const keyframesToDraw = visuals.keyframes.filter(needsDrawing).length;
  const drawn = visuals.keyframes.filter((k) => k.current !== null).length;
  const rendered = visuals.clips.filter((c) => c.current !== null).length;
  const ready = portraitsReady(reel);

  // Clips are rendered for every scene that lacks an up-to-date one, at the model's minimum length.
  const clipScenes = reel.scenes.filter((_, i) => {
    const clip = visuals.clips[i];
    return clip ? needsDrawing(clip) : false;
  });
  const clipSeconds = clipScenes.reduce(
    (sum, s) => sum + Math.max(s.durationSeconds, visuals.minClipSeconds),
    0,
  );
  // The provider bills each clip as at least a few seconds, so short scenes cost more per second.
  const billedSeconds = clipScenes.reduce(
    (sum, s) => sum + Math.max(s.durationSeconds, visuals.minClipSeconds, visuals.minBilledSeconds),
    0,
  );
  const clipCost = dollars(billedSeconds * visuals.videoCostPerSecondUsd);
  const keyframesReady = visuals.keyframes.length > 0 && visuals.keyframes.every(isReady);

  if (!visuals.available) {
    return <Alert tone="info">Drawing pictures is not set up for this workspace yet.</Alert>;
  }

  const start = (kind: ReelVisualKind) =>
    draw.mutate({ kind, idempotencyKey: crypto.randomUUID() });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-label text-ink">Pictures and clips</h3>
        <p className="text-caption text-ink-secondary">
          First the cast, then one keyframe per scene, then a short clip from each keyframe. Only
          missing or outdated ones are made; text edits never need a redraw.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {portraitsToDraw > 0 ? (
          <Button
            loading={draw.isPending && draw.variables?.kind === 'portraits'}
            disabled={draw.isPending}
            onClick={() => start('portraits')}
          >
            <Users className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Draw cast ({portraitsToDraw}) · {dollars(portraitsToDraw * visuals.imageCostUsd)}
          </Button>
        ) : null}
        {keyframesToDraw > 0 ? (
          <Button
            variant={portraitsToDraw > 0 ? 'secondary' : 'primary'}
            loading={draw.isPending && draw.variables?.kind === 'keyframes'}
            disabled={draw.isPending || !ready}
            onClick={() => start('keyframes')}
          >
            <Images className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Draw keyframes ({keyframesToDraw}) · {dollars(keyframesToDraw * visuals.imageCostUsd)}
          </Button>
        ) : null}
        {visuals.videoAvailable && clipScenes.length > 0 ? (
          <Button
            variant={keyframesToDraw > 0 || portraitsToDraw > 0 ? 'secondary' : 'primary'}
            loading={draw.isPending && draw.variables?.kind === 'clips'}
            disabled={draw.isPending || !keyframesReady}
            onClick={() => setConfirmRender(true)}
          >
            <Film className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Render clips ({clipScenes.length}) · {clipCost}
          </Button>
        ) : null}
        {drawn > 0 ? (
          <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
            <Clapperboard className="size-4" strokeWidth={1.5} aria-hidden="true" />
            {rendered > 0
              ? `Preview (${rendered} of ${visuals.clips.length} clips)`
              : `Preview (${drawn} of ${visuals.keyframes.length})`}
          </Button>
        ) : null}
      </div>
      {!ready && keyframesToDraw > 0 ? (
        <p className="text-caption text-ink-secondary">
          Keyframes unlock once every person in the cast has a portrait.
        </p>
      ) : null}
      {visuals.videoAvailable && clipScenes.length > 0 && !keyframesReady ? (
        <p className="text-caption text-ink-secondary">
          Clips unlock once every scene has an up-to-date keyframe. Check the preview first: video
          costs more than pictures.
        </p>
      ) : null}
      {draw.isError ? (
        <Alert tone="danger">
          {draw.error instanceof ApiError ? draw.error.message : 'We could not start. Try again.'}
        </Alert>
      ) : null}
      <ConfirmDialog
        open={confirmRender}
        onOpenChange={setConfirmRender}
        title={`Render ${clipScenes.length} clips?`}
        description={`${clipSeconds} seconds of video, ${clipCost} (each clip is billed as at least ${visuals.minBilledSeconds} seconds). Clips take two to three minutes. You can re-render any single scene later without redoing the rest.`}
        confirmLabel="Render clips"
        onConfirm={() => start('clips')}
      />
      <AnimaticPlayer reel={reel} open={previewOpen} onOpenChange={setPreviewOpen} />
    </Card>
  );
}
