'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Building2 } from 'lucide-react';
import type { Competitor } from '@marketpilot/contracts';
import { Button } from '@marketpilot/ui';

interface CompetitorCardProps {
  competitor: Competitor;
  canEdit: boolean;
  busy: boolean;
  onKeep: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-body text-ink">
      <span className="text-ink-secondary">{label}: </span>
      {value}
    </p>
  );
}

export function CompetitorCard({ competitor, canEdit, busy, onKeep, onEdit, onRemove }: CompetitorCardProps) {
  const [confirming, setConfirming] = useState(false);
  const { name, websiteUrl, logoUrl, summary, whySimilar, offerings, priceRange, positioning } = competitor;
  const suggested = competitor.status === 'suggested';

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface">
          {logoUrl ? (
            <Image src={logoUrl} alt="" fill unoptimized className="object-contain p-1" />
          ) : (
            <Building2 className="size-5 text-ink-tertiary" strokeWidth={1.5} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label text-ink">{name}</p>
          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-caption text-accent underline underline-offset-2"
            >
              {hostOf(websiteUrl)}
            </a>
          ) : null}
        </div>
      </div>

      {summary ? <p className="text-body text-ink">{summary}</p> : null}
      <Detail label="Why they compete" value={whySimilar} />
      {offerings.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label={`What ${name} sells`}>
          {offerings.map((item) => (
            <li key={item} className="rounded-full bg-subtle px-2 text-caption text-ink">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <Detail label="Price level" value={priceRange} />
      <Detail label="How they present themselves" value={positioning} />

      {canEdit ? (
        confirming ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Remove ${name}?`}>
            <span className="text-caption text-ink-secondary">Remove this competitor?</span>
            <Button variant="danger" size="sm" loading={busy} onClick={onRemove}>
              Remove
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggested ? (
              <Button size="sm" loading={busy} onClick={onKeep} aria-label={`Keep ${name}`}>
                Keep
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={busy} aria-label={`Edit ${name}`}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={suggested ? onRemove : () => setConfirming(true)}
              disabled={busy}
              aria-label={`Remove ${name}`}
            >
              Remove
            </Button>
          </div>
        )
      ) : null}
    </li>
  );
}
