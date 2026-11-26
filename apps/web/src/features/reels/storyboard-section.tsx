'use client';

import { Clock, Plus } from 'lucide-react';
import { MAX_SCENES, type ReelProject } from '@marketpilot/contracts';
import { Alert, Badge, Button, Skeleton } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { CastCard } from './cast-card';
import { FinalReelCard } from './final-reel-card';
import { PicturesBar } from './pictures-bar';
import { SceneCard } from './scene-card';
import { useAddScene } from './reel-api';

function StoryboardSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="text-body text-ink-secondary">
        Writing the storyboard scene by scene. This takes about a minute.
      </span>
      <Skeleton className="h-tile w-full" />
      <Skeleton className="h-tile w-full" />
    </div>
  );
}

export function StoryboardSection({ reel }: { reel: ReelProject }) {
  const addAtEnd = useAddScene(reel.id);
  const total = reel.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const order = reel.scenes.map((s) => s.id);
  const offBy = total - reel.lengthSeconds;
  const editable = reel.status === 'storyboard_ready';
  const portraits = new Map(reel.visuals.portraits.map((p) => [p.subject, p]));
  const keyframes = new Map(reel.visuals.keyframes.map((k) => [k.subject, k]));
  const clips = new Map(reel.visuals.clips.map((c) => [c.subject, c]));
  const canDraw = editable && reel.visuals.available;
  // A scene's keyframe follows its people's portraits, so each of them needs one first.
  const hasPortraits = (characterIds: string[]) =>
    characterIds.every((id) => portraits.get(id)?.current);

  if (reel.status === 'storyboarding' && reel.scenes.length === 0) return <StoryboardSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      {reel.status === 'storyboarding' ? (
        <Alert tone="info">
          Writing a new storyboard for the idea you picked. It replaces this one when it is ready.
        </Alert>
      ) : null}

      {editable ? <PicturesBar reel={reel} /> : null}
      {editable && (reel.render || reel.visuals.clips.some((c) => c.current)) ? (
        <FinalReelCard reel={reel} />
      ) : null}

      {reel.cast.length > 0 ? (
        <section aria-labelledby="cast" className="flex flex-col gap-3">
          <h3 id="cast" className="text-label text-ink">
            Cast
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {reel.cast.map((c) => (
              <CastCard
                key={c.id}
                reelId={reel.id}
                character={c}
                portrait={portraits.get(c.id)}
                canDraw={canDraw}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="scenes" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="scenes" className="text-label text-ink">
            Scenes
          </h3>
          <Badge tone={offBy === 0 ? 'neutral' : 'warning'}>
            <Clock className="size-3" strokeWidth={1.5} aria-hidden="true" />
            {total} s of {reel.lengthSeconds} s
          </Badge>
        </div>
        {offBy !== 0 ? (
          <p className="text-caption text-ink-secondary">
            {offBy > 0 ? `${offBy} seconds too long.` : `${-offBy} seconds short.`} Change scene
            lengths so they add up to {reel.lengthSeconds} seconds.
          </p>
        ) : null}

        {editable ? (
          <ol className="flex flex-col gap-3">
            {reel.scenes.map((scene, index) => (
              <li key={scene.id}>
                <SceneCard
                  reelId={reel.id}
                  scene={scene}
                  index={index}
                  order={order}
                  cast={reel.cast}
                  keyframe={keyframes.get(scene.id)}
                  clip={clips.get(scene.id)}
                  canDraw={canDraw && hasPortraits(scene.characterIds)}
                  canRender={editable && reel.visuals.videoAvailable}
                />
              </li>
            ))}
          </ol>
        ) : (
          <Skeleton className="h-tile w-full" />
        )}

        {editable && reel.scenes.length < MAX_SCENES ? (
          <Button
            variant="secondary"
            className="self-start"
            loading={addAtEnd.isPending}
            onClick={() => addAtEnd.mutate({ afterSceneId: order.at(-1) ?? null })}
          >
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Add a scene at the end
          </Button>
        ) : null}
        {addAtEnd.isError ? (
          <Alert tone="danger">
            {addAtEnd.error instanceof ApiError
              ? addAtEnd.error.message
              : 'We could not add a scene. Try again.'}
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
