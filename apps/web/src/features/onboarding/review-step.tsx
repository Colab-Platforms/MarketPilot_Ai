'use client';

import { useEffect, useRef } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import type { OnboardingState, ScanCandidate, ScanState } from '@marketpilot/contracts';
import { Alert, Button, Progress, Skeleton, Spinner } from '@marketpilot/ui';
import { ReviewCandidates } from '@/features/scan/review-candidates';
import { useReviewSelection } from '@/features/scan/use-review-selection';
import { isScanActive, useScan, useStartScan } from './onboarding-api';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Reading takes most of the bar; understanding (the AI step) the last stretch.
function progressOf(scan: ScanState | null | undefined): number {
  if (!scan) return 5;
  if (scan.stage === 'understanding') return 90;
  if (scan.pagesDiscovered === 0) return 10;
  return 10 + Math.round((scan.pagesFetched / scan.pagesDiscovered) * 70);
}

function statusOf(scan: ScanState | null | undefined): string {
  if (scan?.stage === 'understanding') return 'Writing your brand profile…';
  if (scan && scan.pagesDiscovered > 0) return `Read ${scan.pagesFetched} of ${scan.pagesDiscovered} pages…`;
  return 'Opening your website…';
}

const placeholderRows = ['Brand colours', 'Products', 'Social pages', 'Who you sell to'];

function Reading({ scan }: { scan: ScanState | null | undefined }) {
  const percent = progressOf(scan);
  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-5">
      <p role="status" aria-live="polite" className="flex items-center justify-center gap-3 text-heading font-semibold">
        <Spinner />
        {statusOf(scan)}
      </p>
      <div className="flex flex-col gap-2">
        <Progress value={percent} max={100} label="Reading progress" className="h-2 bg-line" />
        <span className="text-body tabular-nums text-ink-tertiary">{percent}% done</span>
      </div>
      <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="mk-tour-backdrop h-12" />
        <div className="flex flex-col gap-3 px-5 pb-5">
          <span className="-mt-6 size-12 rounded-lg border-4 border-surface bg-subtle" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          {placeholderRows.map((row) => (
            <div key={row} className="flex flex-col gap-1 border-t border-line pt-3">
              <span className="text-body text-ink-tertiary">{row}</span>
              <Skeleton className="h-6 w-1/2" />
            </div>
          ))}
        </div>
      </div>
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
  const host = hostOf(state.brand.websiteUrl ?? scan?.url ?? '');

  function onSubmit() {
    if (!hasResults) return submit({ skipped: true });
    const decisions = selection.buildDecisions();
    if (decisions) submit({ decisions });
  }

  const title = active ? `Reading ${host}` : hasResults ? 'Is this you?' : 'Your website';
  const description = active
    ? 'This usually takes under a minute. We only read public pages.'
    : hasResults
      ? 'We filled this in from your website. Fix anything that is off. Nothing is saved until you continue.'
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
      aside={
        hasResults ? (
          <p className="flex gap-3 rounded-xl bg-subtle p-4 text-body text-ink-secondary">
            <Info className="mt-0.5 size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>
              <b className="font-semibold text-ink">From your website</b> means we copied it.{' '}
              <b className="font-semibold text-ink">Please check</b> means we guessed, so a quick look helps.
            </span>
          </p>
        ) : undefined
      }
    >
      {startFailed ? (
        <Alert tone="danger">We could not start reading your website. You can try again or continue without it.</Alert>
      ) : null}
      {active && !startFailed ? <Reading scan={scan} /> : null}
      {!active && scan && (failed || candidates.length === 0) ? (
        <Alert tone="info">
          {scan.message ?? `We could not find details on ${host}. You can add them yourself.`}
        </Alert>
      ) : null}
      {!active && scan && !failed && scan.ai.message && scan.ai.status !== 'ok' ? (
        <Alert tone="info">{scan.ai.message} What we found from your website is still shown below.</Alert>
      ) : null}
      {hasResults ? <ReviewCandidates candidates={candidates} rows={rows} brandName={state.brand.name} host={host} /> : null}

      {!active || startFailed ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="min-h-touch font-semibold text-accent" loading={starting} onClick={() => startScan(true)}>
            <RefreshCw className="size-5" strokeWidth={2} aria-hidden="true" />
            Read my website again
          </Button>
          {hasResults ? (
            <Button variant="ghost" className="min-h-touch" onClick={() => submit({ skipped: true })}>
              Skip all of this
            </Button>
          ) : null}
        </div>
      ) : null}
    </StepFrame>
  );
}
