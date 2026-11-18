'use client';

import { useId, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { ImageIcon, Upload } from 'lucide-react';
import { Button, FieldGroup, Input, Spinner } from '@marketpilot/ui';
import { IMAGE_ACCEPT, MAX_IMAGE_MB, imageFileProblem, useImageUpload } from '@/features/media/use-image-upload';

interface LogoInputProps {
  label: string;
  value: string;
  error?: string;
  onChange: (url: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}

// next/image throws on a src that is not a full URL, which a half-typed link is.
function isWebUrl(value: string): boolean {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Upload a logo, or paste a link to one. Either way the field holds a URL, saved with the form.
export function LogoInput({ label, value, error, onChange, onUploadingChange }: LogoInputProps) {
  const linkId = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useImageUpload('brand_logo');
  const [problem, setProblem] = useState<string | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalid = imageFileProblem(file);
    setProblem(invalid);
    if (invalid) return;

    onUploadingChange(true);
    try {
      onChange(await upload.mutateAsync(file));
    } catch {
      setProblem('Your logo could not be uploaded. Try again.');
    } finally {
      onUploadingChange(false);
    }
  }

  return (
    <FieldGroup legend={label} error={problem ?? error}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative flex h-thumb w-thumb shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface">
          {upload.isPending ? (
            <>
              <Spinner />
              <span className="sr-only">Uploading your logo</span>
            </>
          ) : isWebUrl(value) ? (
            <Image src={value} alt="Your logo" fill unoptimized className="object-contain p-2" />
          ) : (
            <ImageIcon className="size-6 text-ink-tertiary" strokeWidth={1.5} aria-hidden="true" />
          )}
        </span>
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              <Upload className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {value ? 'Upload a new logo' : 'Upload logo'}
            </Button>
            {value ? (
              <Button variant="ghost" size="sm" onClick={() => onChange('')} disabled={upload.isPending}>
                Remove
              </Button>
            ) : null}
          </div>
          <span className="text-caption text-ink-secondary">JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB.</span>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onPick(event)}
      />
      <label htmlFor={linkId} className="mt-2 block text-caption text-ink-secondary">
        Or paste a link to your logo
      </label>
      <Input
        id={linkId}
        value={value}
        inputMode="url"
        onChange={(event) => {
          setProblem(null);
          onChange(event.target.value);
        }}
      />
    </FieldGroup>
  );
}
