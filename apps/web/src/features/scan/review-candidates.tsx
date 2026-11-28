'use client';

import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { SECTIONS, isHiddenField, type ScanCandidate } from '@marketpilot/contracts';
import { Alert, Button } from '@marketpilot/ui';
import { BrandSection, LOGO_KEY, LOOK_KEYS } from './review-brand';
import { ProductsSection, ReviewCard, SocialSection } from './review-media';
import { AiReviewRow, ProfileReviewRow } from './review-rows';
import type { AiCandidate, ProductCandidate, ProfileCandidate, RowState, SocialCandidate } from './row-state';

export type { RowState } from './row-state';

// Plain titles for the profile sections a website scan usually fills.
const SECTION_TITLES: Record<string, string> = {
  basics: 'About your business',
  products: 'What you sell',
  audience: 'Your customers',
  brand: 'How your brand comes across',
};

const FIRST_ROWS = 5;
const isLook = (key: string) => (LOOK_KEYS as readonly string[]).includes(key);

type Row = { kind: 'profile'; candidate: ProfileCandidate } | { kind: 'ai'; candidate: AiCandidate };

function DetailSection({
  title,
  items,
  rows,
  sourceLabel,
}: {
  title: string;
  items: Row[];
  rows: RowState;
  sourceLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const extra = items.length - FIRST_ROWS;
  // A rejected value further down the list must not stay out of sight.
  const hiddenError = items.slice(FIRST_ROWS).some((row) => rows.errors[row.candidate.id]);
  const open = expanded || hiddenError;
  const shown = open ? items : items.slice(0, FIRST_ROWS);

  return (
    <ReviewCard title={title}>
      <ul className="-mt-2 flex list-none flex-col p-0">
        {shown.map((row) =>
          row.kind === 'profile' ? (
            <ProfileReviewRow key={row.candidate.id} candidate={row.candidate} rows={rows} sourceLabel={sourceLabel} />
          ) : (
            <AiReviewRow key={row.candidate.id} candidate={row.candidate} rows={rows} sourceLabel={sourceLabel} />
          ),
        )}
      </ul>
      {extra > 0 && !hiddenError ? (
        <Button
          type="button"
          variant="ghost"
          className="-mt-2 min-h-touch self-start px-0 font-semibold text-accent"
          aria-expanded={open}
          onClick={() => setExpanded((v) => !v)}
        >
          {open ? 'Show fewer details' : `Show ${extra} more ${extra === 1 ? 'detail' : 'details'}`}
        </Button>
      ) : null}
    </ReviewCard>
  );
}

interface ReviewCandidatesProps {
  candidates: ScanCandidate[];
  rows: RowState;
  brandName: string;
  host: string;
}

// What a website scan found, laid out as the owner's brand: each detail reads as text
// with an Edit button, guesses are marked, and nothing is saved until the caller submits.
export function ReviewCandidates({ candidates, rows, brandName, host }: ReviewCandidatesProps) {
  const sourceLabel = 'From your website';
  const profile = candidates.filter((c): c is ProfileCandidate => c.kind === 'business_profile');
  const ai = candidates.filter((c): c is AiCandidate => c.kind === 'profile_field');
  const social = candidates.filter((c): c is SocialCandidate => c.kind === 'social_link');
  const products = candidates.filter((c): c is ProductCandidate => c.kind === 'product');

  const logo = profile.find((c) => c.field === 'logoUrl') ?? ai.find((c) => c.key === LOGO_KEY) ?? null;
  const looks = ai.filter((c) => isLook(c.key));
  // Hidden fields stay ticked, so their values are saved without the owner having to review them.
  const details = ai.filter((c) => !isLook(c.key) && c.key !== LOGO_KEY && !isHiddenField(c.key));
  const copied = profile.filter((c) => c.field !== 'logoUrl' && !isHiddenField(c.field));

  const groups = SECTIONS.map((section) => ({
    id: section.id,
    title: SECTION_TITLES[section.id] ?? section.title,
    items: [
      ...(section.id === 'basics' ? copied.map((candidate): Row => ({ kind: 'profile', candidate })) : []),
      ...details.filter((c) => c.section === section.id).map((candidate): Row => ({ kind: 'ai', candidate })),
    ],
  })).filter((group) => group.items.length > 0);

  const guesses = [...looks, ...details].filter((c) => c.basis === 'inferred' && rows.isChecked(c.id)).length;

  return (
    <div className="flex flex-col gap-6">
      {guesses > 0 ? (
        <Alert tone="warning" className="flex items-center gap-3 rounded-lg border-0 font-semibold">
          <span className="flex items-center gap-3">
            <CircleAlert className="size-5 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
            {guesses === 1
              ? '1 thing is our best guess. Please look at the one marked “Please check”.'
              : `${guesses} things are our best guess. Please look at the ones marked “Please check”.`}
          </span>
        </Alert>
      ) : null}
      <BrandSection brandName={brandName} host={host} sourceLabel={sourceLabel} logo={logo} looks={looks} rows={rows} />
      {groups.map((group) => (
        <DetailSection key={group.id} title={group.title} items={group.items} rows={rows} sourceLabel={sourceLabel} />
      ))}
      {social.length > 0 ? <SocialSection social={social} rows={rows} /> : null}
      {products.length > 0 ? <ProductsSection products={products} rows={rows} /> : null}
    </div>
  );
}
