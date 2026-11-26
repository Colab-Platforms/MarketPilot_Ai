'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { FolderOpen, Upload, X } from 'lucide-react';
import type { Asset, AssetKind, AssetSource } from '@marketpilot/contracts';
import { Alert, Button, SegmentedControl, Skeleton, Spinner, cn } from '@marketpilot/ui';
import { PageHeader } from '@/components/page-header';
import { useAuthStore } from '@/lib/auth-store';
import { AssetPreview } from './asset-preview';
import { AssetTile } from './asset-tile';
import { LIBRARY_ACCEPT, useAssets } from './library-api';
import { useLibraryUploads, type PendingUpload } from './use-library-uploads';

const MANAGE_ROLES = new Set(['owner', 'admin', 'manager', 'creator']);
const GRID = 'grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

const KIND_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
] as const;
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'upload', label: 'Uploaded' },
  { value: 'generated', label: 'Made with AI' },
] as const;

type KindFilter = AssetKind | 'all';
type SourceFilter = AssetSource | 'all';

function GridSkeleton() {
  return (
    <div className={GRID} role="status" aria-live="polite">
      <span className="sr-only">Loading your library</span>
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}

function UploadList({ pending, onDismiss }: { pending: PendingUpload[]; onDismiss: (key: string) => void }) {
  if (pending.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Uploads" aria-live="polite">
      {pending.map((upload) =>
        upload.error ? (
          <li key={upload.key}>
            <Alert tone="danger">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words">{upload.error}</span>
                <button
                  type="button"
                  onClick={() => onDismiss(upload.key)}
                  aria-label={`Dismiss the error for ${upload.name}`}
                  className="inline-flex min-h-touch w-control shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </Alert>
          </li>
        ) : (
          <li key={upload.key} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-body">
            <Spinner className="size-4" />
            <span className="min-w-0 truncate">Uploading {upload.name}</span>
          </li>
        ),
      )}
    </ul>
  );
}

export function LibraryPage() {
  const role = useAuthStore((state) => state.context?.role);
  const canManage = role ? MANAGE_ROLES.has(role) : false;
  const [kind, setKind] = useState<KindFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const assets = useAssets({ kind: kind === 'all' ? null : kind, source: source === 'all' ? null : source });
  const uploads = useLibraryUploads();

  const items = assets.data?.pages.flatMap((page) => page.assets) ?? [];
  const canUpload = canManage && (assets.data?.pages[0]?.uploadAvailable ?? false);
  const filtered = kind !== 'all' || source !== 'all';

  const openPicker = () => fileInput.current?.click();
  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    uploads.start(Array.from(event.target.files ?? []));
    event.target.value = '';
  };
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!canUpload || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(true);
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!canUpload) return;
    event.preventDefault();
    setDragging(false);
    uploads.start(Array.from(event.dataTransfer.files));
  };

  const uploadButton = canUpload ? (
    <Button onClick={openPicker}>
      <Upload className="size-4" strokeWidth={1.5} aria-hidden="true" />
      Upload files
    </Button>
  ) : null;

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Library"
        description="Your uploads and generated assets in one place."
        actions={uploadButton}
      />
      <input ref={fileInput} type="file" accept={LIBRARY_ACCEPT} multiple hidden onChange={onPick} />

      <section
        aria-label="Files"
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          'flex flex-col gap-4 rounded-md transition-shadow duration-fast ease-standard',
          dragging && 'ring-2 ring-accent ring-offset-4 ring-offset-canvas',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="File type" options={KIND_OPTIONS} value={kind} onChange={setKind} />
          <SegmentedControl label="Source" options={SOURCE_OPTIONS} value={source} onChange={setSource} />
        </div>

        {canManage && assets.data && !canUpload ? (
          <Alert tone="info">Uploading is not set up for this workspace yet.</Alert>
        ) : null}
        {uploads.notice ? <Alert tone="info">{uploads.notice}</Alert> : null}
        <UploadList pending={uploads.pending} onDismiss={uploads.dismiss} />

        {assets.isPending ? (
          <GridSkeleton />
        ) : assets.isError ? (
          <Alert tone="danger">
            We could not load your library.{' '}
            <button type="button" className="underline underline-offset-2" onClick={() => void assets.refetch()}>
              Try again
            </button>
          </Alert>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-line px-4 py-12 text-center">
            <FolderOpen className="size-5 text-ink-tertiary" strokeWidth={1.5} aria-hidden="true" />
            {filtered ? (
              <>
                <p className="text-body text-ink-secondary">Nothing here matches these filters.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setKind('all');
                    setSource('all');
                  }}
                >
                  Show everything
                </Button>
              </>
            ) : (
              <>
                <p className="text-body text-ink-secondary">
                  {canUpload ? 'Upload photos and videos, or drop them here. ' : ''}Images you make on the{' '}
                  <Link href="/create" className="text-accent underline underline-offset-2">
                    Create page
                  </Link>{' '}
                  appear here too.
                </p>
                {uploadButton}
              </>
            )}
          </div>
        ) : (
          <>
            <ul className={GRID} aria-label="Library files">
              {items.map((asset) => (
                <li key={asset.id}>
                  <AssetTile asset={asset} onOpen={setSelected} />
                </li>
              ))}
            </ul>
            {assets.hasNextPage ? (
              <Button
                variant="secondary"
                className="self-center"
                loading={assets.isFetchingNextPage}
                onClick={() => void assets.fetchNextPage()}
              >
                Show more
              </Button>
            ) : null}
          </>
        )}
      </section>

      <AssetPreview asset={selected} canManage={canManage} onClose={() => setSelected(null)} />
    </div>
  );
}
