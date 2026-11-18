'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { ImagePlus, X } from 'lucide-react';
import type { MediaPurpose } from '@marketpilot/contracts';
import { Button, Spinner, cn } from '@marketpilot/ui';
import { IMAGE_ACCEPT, MAX_IMAGE_MB, imageFileProblem, useImageUpload } from './use-image-upload';

interface ImageListInputProps {
  label: string;
  helper?: string;
  purpose: MediaPurpose;
  max: number;
  urls: string[];
  // Functional, because uploads finish after the owner may have removed or added others.
  onChange: (update: (urls: string[]) => string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  // Labels the first image, when the first one matters (for example a product's main photo).
  firstLabel?: string;
  error?: string;
}

// Several images uploaded straight to storage; the field holds their URLs, saved with the form.
export function ImageListInput(props: ImageListInputProps) {
  const { label, helper, purpose, max, urls, onChange, onUploadingChange, firstLabel, error } = props;
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useImageUpload(purpose);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const slotsLeft = max - urls.length - uploading;

  useEffect(() => onUploadingChange(uploading > 0), [uploading, onUploadingChange]);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    const invalid = picked.map(imageFileProblem).find(Boolean);
    const files = picked.filter((f) => !imageFileProblem(f)).slice(0, Math.max(slotsLeft, 0));
    setProblem(invalid ?? (picked.length > files.length ? `You can add up to ${max} images` : null));
    if (files.length === 0) return;

    setUploading((n) => n + files.length);
    const results = await Promise.allSettled(files.map((file) => upload.mutateAsync(file)));
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (added.length < files.length) setProblem('Some images could not be uploaded. Try again.');
    onChange((current) => [...current, ...added].slice(0, max));
    setUploading((n) => n - files.length);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-label text-ink">
        {label}
      </label>
      {helper ? <p className="text-caption text-ink-secondary">{helper}</p> : null}
      {urls.length + uploading > 0 ? (
        <ul className="flex flex-wrap gap-3" aria-label={label}>
          {urls.map((url, index) => (
            <li key={url} className="relative h-thumb w-thumb overflow-hidden rounded-md border border-line bg-surface">
              <Image src={url} alt={`${label} ${index + 1}`} fill unoptimized className="object-cover" />
              {index === 0 && firstLabel ? (
                <span className="absolute bottom-1 left-1 rounded-sm bg-surface px-1 text-caption text-ink">
                  {firstLabel}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onChange((current) => current.filter((u) => u !== url))}
                aria-label={`Remove image ${index + 1}`}
                className={cn(
                  'absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface text-ink',
                  'hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li
              key={`uploading-${i}`}
              className="flex h-thumb w-thumb items-center justify-center rounded-md border border-line bg-surface"
              role="status"
            >
              <Spinner />
              <span className="sr-only">Uploading image</span>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => void onPick(event)}
        disabled={slotsLeft <= 0}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={slotsLeft <= 0}>
          <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Add images
        </Button>
        <span className="text-caption text-ink-secondary">
          JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB each. Up to {max} images.
        </span>
      </div>
      {problem || error ? (
        <p role="alert" className="text-caption text-danger">
          {problem ?? error}
        </p>
      ) : null}
    </div>
  );
}
