'use client';

import Image from 'next/image';
import { Play, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Asset } from '@marketpilot/contracts';
import { Badge } from '@marketpilot/ui';
import { formatDuration } from './format';

export function assetLabel(asset: Asset): string {
  if (asset.name) return asset.name;
  if (asset.source === 'generated') return 'Image made with AI';
  return asset.kind === 'video' ? 'Uploaded video' : 'Uploaded image';
}

// A video shows its first frame; `#t=` makes browsers seek just past a black opening frame.
export function AssetThumbnail({ asset }: { asset: Asset }) {
  if (asset.kind === 'video') {
    return (
      <video
        src={`${asset.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        className="size-full object-cover"
      />
    );
  }
  return <Image src={asset.url} alt="" fill unoptimized sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover" />;
}

// At a glance: starred as a style reference, and the viewer's own like or dislike.
function TileMarks({ asset }: { asset: Asset }) {
  const rating = asset.feedback?.rating;
  if (!asset.styleReference && !rating) return null;
  return (
    <span className="absolute right-2 top-2 flex gap-1">
      {asset.styleReference ? (
        <Badge tone="accent">
          <Star className="size-3 fill-current" strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Style reference</span>
        </Badge>
      ) : null}
      {rating ? (
        <Badge tone={rating === 'like' ? 'success' : 'neutral'}>
          {rating === 'like' ? (
            <ThumbsUp className="size-3" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ThumbsDown className="size-3" strokeWidth={1.5} aria-hidden="true" />
          )}
          <span className="sr-only">{rating === 'like' ? 'You liked this' : 'You disliked this'}</span>
        </Badge>
      ) : null}
    </span>
  );
}

export function AssetTile({ asset, onOpen }: { asset: Asset; onOpen: (asset: Asset) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      aria-label={`Open ${assetLabel(asset)}`}
      className="relative block aspect-square w-full overflow-hidden rounded-md border border-line bg-subtle transition-shadow duration-fast ease-standard hover:shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <AssetThumbnail asset={asset} />
      {asset.source === 'generated' ? <Badge className="absolute left-2 top-2">AI draft</Badge> : null}
      <TileMarks asset={asset} />
      {asset.kind === 'video' ? (
        <Badge className="absolute bottom-2 left-2">
          <Play className="size-3" strokeWidth={1.5} aria-hidden="true" />
          {asset.durationSeconds !== null ? formatDuration(asset.durationSeconds) : 'Video'}
        </Badge>
      ) : null}
    </button>
  );
}
