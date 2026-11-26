'use client';

import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import {
  CHARACTER_AGE_MAX_CHARS,
  CHARACTER_LOOK_MAX_CHARS,
  CHARACTER_NAME_MAX_CHARS,
  CHARACTER_WARDROBE_MAX_CHARS,
  type ReelCharacter,
  type ReelVisual,
} from '@marketpilot/contracts';
import { Alert, Button, Card, Field, Input, Textarea } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { useRedrawPortrait, useSelectTake, useUpdateCharacter } from './reel-api';
import { VisualFrame } from './visual-frame';

interface CastCardProps {
  reelId: string;
  character: ReelCharacter;
  portrait: ReelVisual | undefined;
  canDraw: boolean;
}

export function CastCard({ reelId, character, portrait, canDraw }: CastCardProps) {
  const redraw = useRedrawPortrait(reelId);
  const select = useSelectTake(reelId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(character.name);
  const [ageRange, setAgeRange] = useState(character.ageRange);
  const [look, setLook] = useState(character.look);
  const [wardrobe, setWardrobe] = useState(character.wardrobe);
  const update = useUpdateCharacter(reelId);
  const incomplete = !name.trim() || !ageRange.trim() || !look.trim() || !wardrobe.trim();

  function startEditing() {
    setName(character.name);
    setAgeRange(character.ageRange);
    setLook(character.look);
    setWardrobe(character.wardrobe);
    setEditing(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (incomplete) return;
    update.mutate(
      {
        characterId: character.id,
        changes: {
          name: name.trim(),
          ageRange: ageRange.trim(),
          look: look.trim(),
          wardrobe: wardrobe.trim(),
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  if (editing) {
    return (
      <Card className="flex flex-col gap-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={name}
                maxLength={CHARACTER_NAME_MAX_CHARS}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Age">
              <Input
                value={ageRange}
                maxLength={CHARACTER_AGE_MAX_CHARS}
                onChange={(e) => setAgeRange(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Look"
            helper="Face, hair, build and skin tone. Keeps the same person in every scene."
          >
            <Textarea
              value={look}
              maxLength={CHARACTER_LOOK_MAX_CHARS}
              rows={3}
              onChange={(e) => setLook(e.target.value)}
            />
          </Field>
          <Field label="Wardrobe">
            <Textarea
              value={wardrobe}
              maxLength={CHARACTER_WARDROBE_MAX_CHARS}
              rows={2}
              onChange={(e) => setWardrobe(e.target.value)}
            />
          </Field>
          {update.isError ? (
            <Alert tone="danger">
              {update.error instanceof ApiError
                ? update.error.message
                : 'We could not save this person. Try again.'}
            </Alert>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" loading={update.isPending} disabled={incomplete}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex gap-4">
      <div className="w-thumb shrink-0">
        <VisualFrame
          visual={portrait}
          shape="portrait"
          alt={`Portrait of ${character.name}`}
          onRedraw={
            canDraw
              ? () =>
                  redraw.mutate({ characterId: character.id, idempotencyKey: crypto.randomUUID() })
              : null
          }
          redrawing={redraw.isPending}
          onSelect={(takeId) => select.mutate(takeId)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h4 className="text-label text-ink">{character.name}</h4>
            <span className="text-caption text-ink-secondary">{character.ageRange}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit ${character.name}`}
            className="w-control-sm px-0"
            onClick={startEditing}
          >
            <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>
        <p className="text-caption text-ink">{character.look}</p>
        <p className="text-caption text-ink-secondary">Wears: {character.wardrobe}</p>
        {redraw.isError || select.isError ? (
          <Alert tone="danger">{errorMessage(redraw.error ?? select.error)}</Alert>
        ) : null}
      </div>
    </Card>
  );
}

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'That did not work. Try again.';
