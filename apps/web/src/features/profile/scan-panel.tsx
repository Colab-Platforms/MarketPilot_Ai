'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import type { ProfileResponse } from '@marketpilot/contracts';
import { Alert, Button, Card, Skeleton, Spinner } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { ReviewCandidates } from '@/features/scan/review-candidates';
import { useReviewSelection } from '@/features/scan/use-review-selection';
import { isScanActive, useApplyScanReview, useProfileScan, useStartProfileScan } from './profile-api';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface ScanPanelProps {
  brand: ProfileResponse['brand'];
  logoUrl: string | null;
  canEdit: boolean;
  onAddWebsite: () => void;
}

export function ScanPanel({ brand, logoUrl, canEdit, onAddWebsite }: ScanPanelProps) {
  const query = useProfileScan();
  const start = useStartProfileScan();
  const apply = useApplyScanReview();
  const [dismissed, setDismissed] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [applyError, setApplyError] = useState<string | null>(null);

  const scan = query.data?.scan ?? null;
  const candidates = scan?.candidates ?? [];
  const selection = useReviewSelection(candidates);
  const active = start.isPending || isScanActive(scan);
  const failed = scan?.status === 'failed' || scan?.status === 'cancelled';
  const hasResults = !active && !failed && candidates.length > 0 && !dismissed;

  function read(force: boolean) {
    setDismissed(false);
    setApplyError(null);
    start.mutate(force);
  }

  function onApply() {
    const decisions = selection.buildDecisions();
    if (!decisions) return;
    setApplyError(null);
    apply.mutate(decisions, {
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fields).length > 0) setServerErrors(error.fields);
        setApplyError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
      },
    });
  }

  const title = brand.websiteUrl ? `Your website: ${hostOf(brand.websiteUrl)}` : 'Fill in your profile from your website';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-line bg-surface">
              <Image src={logoUrl} alt="Your logo" fill unoptimized className="object-contain p-1" />
            </span>
          ) : (
            <Globe className="size-5 shrink-0 text-ink-secondary" strokeWidth={1.5} aria-hidden="true" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-heading">{title}</h2>
            <p className="text-caption text-ink-secondary">
              {active
                ? 'Reading your website. This usually takes under a minute.'
                : brand.websiteUrl
                  ? 'Read it again any time to pick up new products or details. Nothing changes until you approve it.'
                  : 'Add your website and we will find your details, products and social profiles for you.'}
            </p>
          </div>
        </div>
        {canEdit && !active ? (
          brand.websiteUrl ? (
            <Button variant="secondary" onClick={() => read(true)}>
              {scan ? 'Read my website again' : 'Read my website'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onAddWebsite}>
              Add my website
            </Button>
          )
        ) : null}
      </div>

      {query.isError ? <Alert tone="danger">We could not check your website scan. Refresh to try again.</Alert> : null}
      {start.isError ? (
        <Alert tone="danger">
          {start.error instanceof ApiError ? start.error.message : 'We could not start reading your website.'}
        </Alert>
      ) : null}

      {active ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-body text-ink-secondary">
            <Spinner />
            {scan?.stage === 'understanding'
              ? 'Understanding your business. Our AI is drafting your profile from what we read.'
              : scan && scan.pagesDiscovered > 0
                ? `Read ${scan.pagesFetched} of ${scan.pagesDiscovered} pages`
                : 'Opening your website'}
          </p>
          <Skeleton className="h-control w-full" />
        </div>
      ) : null}

      {!active && scan && !failed && scan.ai.message && scan.ai.status !== 'ok' ? (
        <Alert tone="info">{scan.ai.message} What we found from your website is still shown below.</Alert>
      ) : null}

      {!active && scan && (failed || (candidates.length === 0 && scan.message)) ? (
        <Alert tone="info">{scan.message ?? 'We could not find details to add.'}</Alert>
      ) : null}

      {hasResults ? (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-heading">We found {candidates.length} things to review</h3>
            <p className="text-caption text-ink-secondary">
              Untick what is wrong and edit what is close. Only what you keep is added to your profile.
            </p>
          </div>
          <ReviewCandidates
            candidates={candidates}
            brandName={brand.name}
            host={brand.websiteUrl ? hostOf(brand.websiteUrl) : hostOf(scan?.url ?? '')}
            rows={selection.rowsFor(serverErrors, (id) => setServerErrors(({ [id]: _cleared, ...rest }) => rest))}
          />
          {applyError ? <Alert tone="danger">{applyError}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setDismissed(true)} disabled={apply.isPending}>
              Not now
            </Button>
            <Button onClick={onApply} loading={apply.isPending}>
              Add to my profile
            </Button>
          </div>
        </div>
      ) : null}

      {!active && apply.isSuccess && !hasResults ? (
        <Alert tone="success">Added to your profile. You can edit any of it below.</Alert>
      ) : null}
    </Card>
  );
}
