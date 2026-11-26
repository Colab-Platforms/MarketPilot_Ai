'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { Spinner, cn } from '@marketpilot/ui';

interface AttachmentsProps {
  urls: string[];
  uploading: number;
  onRemove(url: string): void;
}

// Reference images waiting to be sent with the next message.
export function CopilotAttachments({ urls, uploading, onRemove }: AttachmentsProps) {
  if (urls.length + uploading === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Reference images to add">
      {urls.map((url, index) => (
        <li key={url} className="relative size-12 overflow-hidden rounded-sm border border-line bg-surface">
          <Image src={url} alt={`Reference image ${index + 1}`} fill unoptimized className="object-cover" />
          <button
            type="button"
            onClick={() => onRemove(url)}
            aria-label={`Remove reference image ${index + 1}`}
            className={cn(
              'absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-surface text-ink',
              'hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <X className="size-3" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </li>
      ))}
      {Array.from({ length: uploading }, (_, i) => (
        <li
          key={`uploading-${i}`}
          role="status"
          className="flex size-12 items-center justify-center rounded-sm border border-line bg-surface"
        >
          <Spinner className="size-4" />
          <span className="sr-only">Uploading image</span>
        </li>
      ))}
    </ul>
  );
}

export function SentImages({ urls }: { urls: string[] }) {
  return (
    <ul className="flex flex-wrap justify-end gap-2" aria-label="Reference images added">
      {urls.map((url, index) => (
        <li key={url} className="relative size-16 overflow-hidden rounded-md border border-line bg-surface">
          <Image src={url} alt={`Reference image ${index + 1}`} fill unoptimized className="object-cover" />
        </li>
      ))}
    </ul>
  );
}
