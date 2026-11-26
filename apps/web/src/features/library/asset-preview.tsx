'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Trash2 } from 'lucide-react';
import type { Asset } from '@marketpilot/contracts';
import { Alert, Button, Dialog } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { assetLabel } from './asset-tile';
import { FeedbackBar } from './feedback-bar';
import { formatBytes, formatDate, formatDuration } from './format';
import { useDeleteAsset } from './library-api';

interface AssetPreviewProps {
  asset: Asset | null;
  canManage: boolean;
  onClose: () => void;
}

function details(asset: Asset): [string, string][] {
  const rows: [string, string | null][] = [
    ['Source', asset.source === 'generated' ? 'Made with AI' : 'Uploaded'],
    ['Type', asset.kind === 'video' ? 'Video' : 'Image'],
    ['Size', asset.width && asset.height ? `${asset.width} × ${asset.height}` : null],
    ['Length', asset.durationSeconds !== null ? formatDuration(asset.durationSeconds) : null],
    ['File size', asset.bytes !== null ? formatBytes(asset.bytes) : null],
    ['Added', formatDate(asset.createdAt)],
  ];
  return rows.flatMap(([label, value]) => (value ? [[label, value] as [string, string]] : []));
}

export function AssetPreview({ asset, canManage, onClose }: AssetPreviewProps) {
  const remove = useDeleteAsset();
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    remove.reset();
    onClose();
  };

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => (open ? undefined : close())}
      title={asset ? assetLabel(asset) : ''}
      description={asset?.source === 'generated' ? 'AI draft. Check it before you post it.' : undefined}
    >
      {asset ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center overflow-hidden rounded-md bg-subtle">
            {asset.kind === 'video' ? (
              <video src={asset.url} controls playsInline preload="metadata" className="max-h-preview w-full">
                <track kind="captions" />
              </video>
            ) : (
              <Image
                src={asset.url}
                alt={assetLabel(asset)}
                width={asset.width ?? 1080}
                height={asset.height ?? 1080}
                unoptimized
                className="h-auto max-h-preview w-auto max-w-full object-contain"
              />
            )}
          </div>

          {asset.kind === 'image' ? (
            <FeedbackBar
              assetId={asset.id}
              rateable={asset.source === 'generated'}
              styleReference={asset.styleReference}
              feedback={asset.feedback}
            />
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
            {details(asset).map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-ink-secondary">{label}</dt>
                <dd className="text-body text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {remove.isError ? (
            <Alert tone="danger">
              {remove.error instanceof ApiError ? remove.error.message : 'We could not remove this file. Try again.'}
            </Alert>
          ) : null}

          {confirming ? (
            <div className="flex flex-col gap-3 rounded-md border border-line p-3 md:flex-row md:items-center md:justify-between">
              <p className="text-body">Remove this file from your library?</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={remove.isPending}
                  onClick={() => remove.mutate(asset.id, { onSuccess: close })}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <a href={asset.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Open full size
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
              {canManage ? (
                <Button variant="ghost" onClick={() => setConfirming(true)}>
                  <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Remove from library
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
