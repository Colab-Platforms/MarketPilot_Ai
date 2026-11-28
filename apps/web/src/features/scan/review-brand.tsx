'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button, Field, Input } from '@marketpilot/ui';
import { ReviewCard } from './review-media';
import { AiReviewRow } from './review-rows';
import type { AiCandidate, ProfileCandidate, RowState } from './row-state';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

// The logo can come as a copied detail or as an AI suggestion; both are a web address.
function logoAccess(logo: ProfileCandidate | AiCandidate, rows: RowState) {
  if (logo.kind === 'business_profile') {
    return { value: rows.valueOf(logo), save: (url: string) => rows.edit(logo.id, url) };
  }
  const draft = rows.draftOf(logo);
  return { value: Array.isArray(draft) ? '' : draft, save: (url: string) => rows.editDraft(logo.id, url) };
}

function LogoTile({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (url && broken !== url) {
    return (
      <span className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
        <Image src={url} alt={`${name} logo`} fill unoptimized sizes="64px" className="object-contain p-1" onError={() => setBroken(url)} />
      </span>
    );
  }
  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-tile-ink font-display text-title font-bold text-highlight">
      {initialsOf(name) || '?'}
    </span>
  );
}

interface BrandSectionProps {
  brandName: string;
  host: string;
  sourceLabel: string;
  logo: ProfileCandidate | AiCandidate | null;
  looks: AiCandidate[];
  rows: RowState;
}

export function BrandSection({ brandName, host, sourceLabel, logo, looks, rows }: BrandSectionProps) {
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const access = logo ? logoAccess(logo, rows) : null;
  const logoOn = logo ? rows.isChecked(logo.id) : false;
  const logoError = logo ? rows.errors[logo.id] : undefined;
  const editingLogo = logoDraft !== null || Boolean(logoError);
  const note = [host, logo ? (logoOn ? 'Logo from your website' : 'Logo not used') : null].filter(Boolean).join(' · ');

  return (
    <ReviewCard title="Your brand">
      <div className="flex flex-wrap items-center gap-4">
        <LogoTile url={logoOn ? (access?.value ?? null) : null} name={brandName} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-heading">{brandName}</span>
          <span className="break-words text-body text-ink-tertiary">{note}</span>
        </span>
        {logo && access && !editingLogo ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-touch px-4 font-semibold"
            onClick={() => {
              if (!logoOn) rows.setChecked([logo.id], true);
              setLogoDraft(access.value);
            }}
          >
            {logoOn ? 'Change logo' : 'Use the logo'}
          </Button>
        ) : null}
      </div>

      {logo && access && editingLogo ? (
        <div className="flex flex-col gap-3">
          <Field label="Logo web address" helper="A link to your logo image, starting with https://" error={logoError}>
            <Input type="url" inputMode="url" value={logoDraft ?? access.value} onChange={(e) => setLogoDraft(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="min-h-touch px-5"
              onClick={() => {
                access.save((logoDraft ?? access.value).trim());
                setLogoDraft(null);
              }}
            >
              Save
            </Button>
            <Button type="button" variant="ghost" className="min-h-touch font-semibold text-accent" onClick={() => setLogoDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto min-h-touch text-ink-secondary"
              onClick={() => {
                rows.setChecked([logo.id], false);
                setLogoDraft(null);
              }}
            >
              Do not use a logo
            </Button>
          </div>
        </div>
      ) : null}

      {looks.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {looks.map((candidate) => (
            <AiReviewRow
              key={candidate.id}
              candidate={candidate}
              rows={rows}
              sourceLabel={sourceLabel}
              colours={candidate.valueKind === 'tags' && /colou?rs/i.test(candidate.key)}
              label={LOOK_LABELS[candidate.key]}
            />
          ))}
        </ul>
      ) : null}
    </ReviewCard>
  );
}

// Keys of the fields shown in this card instead of in the lists below.
export const LOOK_KEYS = ['primaryColors', 'secondaryColors', 'fonts'] as const;
export const LOGO_KEY = 'logoUrl';

const LOOK_LABELS: Record<string, string> = {
  primaryColors: 'Brand colours',
  secondaryColors: 'Other colours',
  fonts: 'Brand font',
};
