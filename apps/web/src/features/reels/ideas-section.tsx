'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ReelProject } from '@marketpilot/contracts';
import { Alert, Button, ConfirmDialog, Skeleton } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { IdeaCard } from './idea-card';
import { isWorking, useChooseIdea, useMoreIdeas } from './reel-api';

export function IdeasSection({ reel }: { reel: ReelProject }) {
  const choose = useChooseIdea(reel.id);
  const more = useMoreIdeas(reel.id);
  const [confirmIdeaId, setConfirmIdeaId] = useState<string | null>(null);
  const busy = isWorking(reel.status) || choose.isPending || more.isPending;
  const error = choose.error ?? more.error;

  const startStoryboard = (ideaId: string) =>
    choose.mutate({ ideaId, idempotencyKey: crypto.randomUUID() });
  // Choosing again replaces a storyboard the owner may have edited, so it asks first.
  const askToChoose = (ideaId: string) =>
    reel.chosenIdeaId ? setConfirmIdeaId(ideaId) : startStoryboard(ideaId);

  return (
    <div className="flex flex-col gap-4">
      {reel.ideas.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {reel.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              chosen={idea.id === reel.chosenIdeaId}
              choosing={choose.isPending && choose.variables?.ideaId === idea.id}
              onChoose={busy ? null : () => askToChoose(idea.id)}
            />
          ))}
        </div>
      ) : null}

      {reel.status === 'ideating' ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <span className="text-body text-ink-secondary">
            Reading what is working on Reels right now and writing ideas for your product. This
            takes up to a minute.
          </span>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-tile w-full" />
            <Skeleton className="h-tile w-full" />
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert tone="danger">
          {error instanceof ApiError ? error.message : 'That did not work. Try again.'}
        </Alert>
      ) : null}

      {reel.canAskForMoreIdeas ? (
        <Button
          variant="secondary"
          className="self-start"
          loading={more.isPending}
          disabled={busy}
          onClick={() => more.mutate(crypto.randomUUID())}
        >
          <RefreshCw className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {reel.ideas.length === 0 ? 'Try again' : 'Show 3 more ideas'}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmIdeaId !== null}
        onOpenChange={(open) => !open && setConfirmIdeaId(null)}
        title="Use this idea instead?"
        description="A new storyboard is written for it and replaces your current one, including your edits."
        confirmLabel="Replace storyboard"
        onConfirm={() => confirmIdeaId && startStoryboard(confirmIdeaId)}
      />
    </div>
  );
}
