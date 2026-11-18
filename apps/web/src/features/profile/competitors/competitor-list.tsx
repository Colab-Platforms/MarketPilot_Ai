'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import type { Competitor } from '@marketpilot/contracts';
import { Alert, Button, Skeleton, Spinner } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { useCompetitors, useDiscoverCompetitors, useRemoveCompetitor, useUpdateCompetitor } from './competitor-api';
import { CompetitorCard } from './competitor-card';
import { CompetitorEditor } from './competitor-editor';

function Discover({ canEdit, retry }: { canEdit: boolean; retry: boolean }) {
  const discover = useDiscoverCompetitors();
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-line bg-subtle p-4">
      <div>
        <p className="text-label text-ink">Find your competitors</p>
        <p className="text-caption text-ink-secondary">
          We search the web once for businesses like yours and check that each one is real. After that, you add or
          edit competitors yourself.
        </p>
      </div>
      {discover.isError ? (
        <Alert tone="danger">
          {discover.error instanceof ApiError ? discover.error.message : 'We could not start the search. Try again.'}
        </Alert>
      ) : null}
      {canEdit ? (
        <Button onClick={() => discover.mutate()} loading={discover.isPending}>
          <Search className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {retry ? 'Try again' : 'Find competitors'}
        </Button>
      ) : null}
    </div>
  );
}

export function CompetitorList({ canEdit }: { canEdit: boolean }) {
  const query = useCompetitors();
  const update = useUpdateCompetitor();
  const remove = useRemoveCompetitor();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-live="polite">
        <span className="sr-only">Loading competitors</span>
        <Skeleton className="h-control w-full" />
        <Skeleton className="h-control w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Alert tone="danger">
        We could not load your competitors.{' '}
        <button type="button" className="underline underline-offset-2" onClick={() => void query.refetch()}>
          Try again
        </button>
      </Alert>
    );
  }

  const { competitors, discovery } = query.data;
  const suggested = competitors.filter((c) => c.status === 'suggested');
  const kept = competitors.filter((c) => c.status === 'kept');
  const running = discovery.status === 'running';

  const act = (id: string, run: (done: { onSettled: () => void; onError: (e: unknown) => void }) => void) => {
    setBusy(id);
    setActionError(null);
    run({
      onSettled: () => setBusy(null),
      onError: (e) => setActionError(e instanceof ApiError ? e.message : 'That did not work. Try again.'),
    });
  };
  const keep = (c: Competitor) => act(c.id, (o) => update.mutate({ id: c.id, changes: { keep: true } }, o));
  const drop = (c: Competitor) => act(c.id, (o) => remove.mutate(c.id, o));
  const card = (c: Competitor) =>
    editing === c.id ? (
      <li key={c.id}>
        <CompetitorEditor competitor={c} onDone={() => setEditing(null)} />
      </li>
    ) : (
      <CompetitorCard
        key={c.id}
        competitor={c}
        canEdit={canEdit}
        busy={busy === c.id}
        onKeep={() => keep(c)}
        onEdit={() => setEditing(c.id)}
        onRemove={() => drop(c)}
      />
    );

  return (
    <section aria-labelledby="competitors-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="competitors-heading" className="text-heading">
          Your competitors{kept.length > 0 ? ` (${kept.length})` : ''}
        </h3>
        {canEdit && editing !== 'new' ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            Add competitor
          </Button>
        ) : null}
      </div>

      {discovery.canStart && !running ? <Discover canEdit={canEdit} retry={discovery.status === 'failed'} /> : null}
      {running ? (
        <p className="flex items-center gap-2 text-body text-ink-secondary" role="status" aria-live="polite">
          <Spinner />
          Searching the web for businesses like yours. This takes about a minute.
        </p>
      ) : null}
      {!running && discovery.message ? <Alert tone="info">{discovery.message}</Alert> : null}
      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
      {editing === 'new' ? <CompetitorEditor competitor={null} onDone={() => setEditing(null)} /> : null}

      {suggested.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-label text-ink">We found {suggested.length} to review</p>
            <p className="text-caption text-ink-secondary">Keep the ones that really compete with you, and remove the rest.</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">{suggested.map(card)}</ul>
        </div>
      ) : null}

      {kept.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">{kept.map(card)}</ul>
      ) : suggested.length === 0 && !running && !discovery.canStart && editing !== 'new' ? (
        <p className="text-body text-ink-secondary">No competitors yet. Add the businesses you compete with.</p>
      ) : null}
    </section>
  );
}
