'use client';

import { useEffect, useRef } from 'react';
import type { OnboardingState, ScanCandidate, ScanState } from '@marketpilot/contracts';
import { Alert, Button, Skeleton, Spinner } from '@marketpilot/ui';
import { isScanActive, useScan, useStartScan } from './onboarding-api';
import { ReviewCandidates } from '@/features/scan/review-candidates';
import { useReviewSelection } from '@/features/scan/use-review-selection';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Reading({ scan }: { scan: ScanState | null | undefined }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-body text-ink-secondary">
        <Spinner />
        {scan?.stage === 'understanding'
          ? 'Understanding your business. Our AI is drafting your profile from what we read.'
          : scan && scan.pagesDiscovered > 0
            ? `Read ${scan.pagesFetched} of ${scan.pagesDiscovered} pages on ${hostOf(scan.url)}`
            : 'Opening your website'}
      </p>
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-control w-3/4" />
    </div>
  );
}

export function ReviewStep({ state }: { state: OnboardingState }) {
  const { mutate: startScan, isSuccess: started, isError: startFailed, isPending: starting, data: startData } = useStartScan();
  const scanQuery = useScan(started);
  const { submit, saving, fieldErrors, setFieldErrors, formError } = useStepSubmit('review');
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    startScan(false);
  }, [startScan]);

  const scan = scanQuery.data?.scan ?? startData?.scan ?? null;
  const active = !startFailed && (!scan || isScanActive(scan));
  const candidates: ScanCandidate[] = scan?.candidates ?? [];
  const failed = scan?.status === 'failed' || scan?.status === 'cancelled';
  const hasResults = !active && !failed && candidates.length > 0;
  const selection = useReviewSelection(candidates);
  const rows = selection.rowsFor(fieldErrors, (id) => setFieldErrors(({ [id]: _cleared, ...rest }) => rest));

  function onSubmit() {
    if (!hasResults) return submit({ skipped: true });
    const decisions = selection.buildDecisions();
    if (decisions) submit({ decisions });
  }

  const title = active ? 'Reading your website' : hasResults ? 'Is this right?' : 'Your website';
  const description = active
    ? 'This usually takes under a minute. We only read public pages.'
    : hasResults
      ? 'Nothing is saved to your profile until you continue. Untick what is wrong and edit what is close.'
      : undefined;

  return (
    <StepFrame
      step="review"
      title={title}
      description={description}
      error={formError}
      saving={saving}
      submitLabel={hasResults ? 'Looks good, continue' : 'Continue'}
      submitDisabled={active}
      onSubmit={onSubmit}
    >
      {startFailed ? (
        <Alert tone="danger">We could not start reading your website. You can try again or continue without it.</Alert>
      ) : null}
      {active && !startFailed ? <Reading scan={scan} /> : null}
      {!active && scan && (failed || candidates.length === 0) ? (
        <Alert tone="info">
          {scan.message ?? `We could not find details on ${hostOf(state.brand.websiteUrl ?? scan.url)}. You can add them yourself.`}
        </Alert>
      ) : null}
      {!active && scan && !failed && scan.ai.message && scan.ai.status !== 'ok' ? (
        <Alert tone="info">{scan.ai.message} What we found from your website is still shown below.</Alert>
      ) : null}
      {hasResults ? <ReviewCandidates candidates={candidates} rows={rows} /> : null}

      {!active || startFailed ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={starting} onClick={() => startScan(true)}>
            Read my website again
          </Button>
          {hasResults ? (
            <Button variant="ghost" onClick={() => submit({ skipped: true })}>
              Skip all of this
            </Button>
          ) : null}
        </div>
      ) : null}
    </StepFrame>
  );
}
