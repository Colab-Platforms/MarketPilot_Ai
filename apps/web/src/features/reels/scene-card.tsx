'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  EllipsisVertical,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  MIN_SCENES,
  REEL_CAMERAS,
  REEL_SHOTS,
  type ReelCharacter,
  type ReelScene,
  type ReelVisual,
} from '@marketpilot/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { RewriteDialog } from './rewrite-dialog';
import { SceneForm } from './scene-form';
import {
  useAddScene,
  useDeleteScene,
  useRedrawKeyframe,
  useRerenderClip,
  useReorderScenes,
  useRewriteScene,
  useSelectTake,
  useUpdateScene,
} from './reel-api';
import { VisualFrame } from './visual-frame';

const SHOT_LABELS = new Map<string, string>(REEL_SHOTS.map((s) => [s.value, s.label]));
const CAMERA_LABELS = new Map<string, string>(REEL_CAMERAS.map((c) => [c.value, c.label]));

interface SceneCardProps {
  reelId: string;
  scene: ReelScene;
  index: number;
  order: string[];
  cast: ReelCharacter[];
  keyframe: ReelVisual | undefined;
  clip: ReelVisual | undefined;
  // False until everyone in this scene has a portrait, or when pictures are not set up.
  canDraw: boolean;
  // False when video is not set up or the reel is busy; an outdated keyframe also blocks it.
  canRender: boolean;
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function SceneCard({
  reelId,
  scene,
  index,
  order,
  cast,
  keyframe,
  clip,
  canDraw,
  canRender,
}: SceneCardProps) {
  const [editing, setEditing] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const update = useUpdateScene(reelId);
  const rewrite = useRewriteScene(reelId);
  const remove = useDeleteScene(reelId);
  const add = useAddScene(reelId);
  const reorder = useReorderScenes(reelId);

  const number = index + 1;
  const people = cast.filter((c) => scene.characterIds.includes(c.id));
  const redrawKeyframe = useRedrawKeyframe(reelId);
  const rerenderClip = useRerenderClip(reelId);
  const select = useSelectTake(reelId);
  const moveError =
    reorder.error ??
    remove.error ??
    add.error ??
    redrawKeyframe.error ??
    rerenderClip.error ??
    select.error;

  function move(step: -1 | 1) {
    const next = [...order];
    const target = index + step;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.mutate({ sceneIds: next });
  }

  if (editing) {
    return (
      <Card className="flex flex-col gap-4">
        <h3 className="text-label text-ink">Scene {number}</h3>
        <SceneForm
          scene={scene}
          cast={cast}
          saving={update.isPending}
          error={
            update.isError
              ? errorText(update.error, 'We could not save this scene. Try again.')
              : null
          }
          onSave={(changes) =>
            update.mutate({ sceneId: scene.id, changes }, { onSuccess: () => setEditing(false) })
          }
          onCancel={() => setEditing(false)}
        />
      </Card>
    );
  }

  return (
    <Card className="flex gap-4">
      <div className="flex shrink-0 flex-col gap-3 md:flex-row">
        <div className="w-thumb md:w-tile">
          <VisualFrame
            visual={keyframe}
            shape="story"
            alt={`Keyframe for scene ${number}: ${scene.action}`}
            onRedraw={
              canDraw
                ? () =>
                    redrawKeyframe.mutate({
                      sceneId: scene.id,
                      idempotencyKey: crypto.randomUUID(),
                    })
                : null
            }
            redrawing={redrawKeyframe.isPending}
            onSelect={(takeId) => select.mutate(takeId)}
          />
        </div>
        {keyframe?.current ? (
          <div className="w-thumb md:w-tile">
            <VisualFrame
              visual={clip}
              shape="story"
              media="video"
              alt={`Clip for scene ${number}: ${scene.action}`}
              onRedraw={
                canRender && !keyframe.outdated
                  ? () =>
                      rerenderClip.mutate({
                        sceneId: scene.id,
                        idempotencyKey: crypto.randomUUID(),
                      })
                  : null
              }
              redrawing={rerenderClip.isPending}
              onSelect={(takeId) => select.mutate(takeId)}
            />
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-label text-ink">Scene {number}</h3>
            <span className="text-caption text-ink-secondary">
              {scene.durationSeconds} s · {SHOT_LABELS.get(scene.shot)} ·{' '}
              {CAMERA_LABELS.get(scene.camera)}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Scene ${number} actions`}
                className="w-control-sm px-0"
              >
                <EllipsisVertical className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-menu">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRewriteOpen(true)}>
                <Sparkles className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Rewrite with AI
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}>
                <ArrowUp className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === order.length - 1} onSelect={() => move(1)}>
                <ArrowDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => add.mutate({ afterSceneId: scene.id })}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Add a scene after
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                tone="danger"
                disabled={order.length <= MIN_SCENES}
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-body text-ink">{scene.action}</p>
        <p className="text-caption text-ink-secondary">{scene.setting}</p>

        <div className="flex flex-wrap gap-2">
          {people.map((c) => (
            <Badge key={c.id}>{c.name}</Badge>
          ))}
          {scene.showsProduct ? (
            <Badge tone="accent">
              <Package className="size-3" strokeWidth={1.5} aria-hidden="true" />
              Product
            </Badge>
          ) : null}
        </div>

        {scene.onScreenText || scene.voiceover ? (
          <dl className="flex flex-col gap-1 rounded-md bg-subtle px-3 py-2">
            {scene.onScreenText ? (
              <div className="flex gap-2 text-caption">
                <dt className="text-ink-tertiary">Text</dt>
                <dd className="text-ink">{scene.onScreenText}</dd>
              </div>
            ) : null}
            {scene.voiceover ? (
              <div className="flex gap-2 text-caption">
                <dt className="text-ink-tertiary">Voice</dt>
                <dd className="text-ink">{scene.voiceover}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {moveError ? (
          <Alert tone="danger">
            {errorText(moveError, 'That change did not save. Try again.')}
          </Alert>
        ) : null}

        <RewriteDialog
          key={rewriteOpen ? 'open' : 'closed'}
          open={rewriteOpen}
          onOpenChange={setRewriteOpen}
          sceneNumber={number}
          rewriting={rewrite.isPending}
          error={
            rewrite.isError
              ? errorText(rewrite.error, 'We could not rewrite this scene. Try again.')
              : null
          }
          onSubmit={(instruction) =>
            rewrite.mutate(
              { sceneId: scene.id, instruction, idempotencyKey: crypto.randomUUID() },
              { onSuccess: () => setRewriteOpen(false) },
            )
          }
        />
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete scene ${number}?`}
          description="The scene and its text are removed from the storyboard."
          confirmLabel="Delete scene"
          tone="danger"
          onConfirm={() => remove.mutate(scene.id)}
        />
      </div>
    </Card>
  );
}
