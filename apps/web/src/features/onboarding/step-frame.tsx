import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ONBOARDING_STEPS, type OnboardingStep } from '@marketpilot/contracts';
import { Alert, Button, cn } from '@marketpilot/ui';
import { entryButton, entryTitle } from '@/features/identity/entry-styles';
import { BrandCard } from './brand-card';
import { useOnboarding } from './onboarding-api';
import { stepLabel } from './setup-copy';

const gridCols: Record<number, string> = { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' };

export function StepProgress({ current }: { current: OnboardingStep }) {
  const state = useOnboarding().data;
  // Which steps apply depends on the account (for example, only a business with a website is scanned).
  const steps = state?.steps ?? ONBOARDING_STEPS;
  const track = state?.track ?? 'business';
  const index = steps.indexOf(current);
  const cols = gridCols[steps.length] ?? 'grid-cols-5';
  return (
    <nav aria-label="Setup progress" className="mb-8 flex flex-col gap-2">
      <p className="text-body font-medium text-ink-tertiary">
        Step {index + 1} of {steps.length}
        <span className="md:hidden"> · {stepLabel(current, track)}</span>
      </p>
      <ol className={cn('m-0 grid list-none gap-1 p-0', cols)}>
        {steps.map((step, position) => (
          <li key={step} aria-current={step === current ? 'step' : undefined} className="flex flex-col gap-2">
            <span className={cn('h-1 rounded-sm', position <= index ? 'bg-accent' : 'bg-line')} />
            <span
              className={cn(
                'hidden text-caption font-medium md:block',
                step === current ? 'font-semibold text-ink' : 'text-ink-tertiary',
              )}
            >
              {stepLabel(step, track)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface StepFrameProps {
  step: OnboardingStep;
  title: string;
  description?: string;
  error?: string | null;
  saving: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  onSubmit: () => void;
  // Overrides the Back link, for steps with more than one screen.
  onBack?: () => void;
  // Extra cards under the brand card on desktop, such as a post preview.
  aside?: ReactNode;
  hideActions?: boolean;
  children: ReactNode;
}

export function StepFrame({
  step,
  title,
  description,
  error,
  saving,
  submitLabel = 'Continue',
  submitDisabled = false,
  onSubmit,
  onBack,
  aside,
  hideActions = false,
  children,
}: StepFrameProps) {
  const state = useOnboarding().data;
  const steps = state?.steps ?? ONBOARDING_STEPS;
  const index = steps.indexOf(step);
  const previous = index > 0 ? steps[index - 1] : null;
  const backClass = cn(entryButton, 'min-h-touch px-3 text-ink');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="flex items-start gap-12">
      <div className="min-w-0 max-w-content flex-1">
        <StepProgress current={step} />
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <h1 className={cn(entryTitle, 'text-title md:text-display')}>{title}</h1>
          {description ? <p className="mt-2 text-lead text-ink-secondary">{description}</p> : null}

          {error ? (
            <Alert tone="danger" className="mt-6">
              {error}
            </Alert>
          ) : null}

          <div className="mt-8 flex flex-col gap-6">{children}</div>

          {hideActions ? null : (
            <div className="sticky bottom-0 z-10 -mx-4 mt-12 flex items-center justify-between gap-3 border-t border-line bg-canvas px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
              {onBack ? (
                <Button type="button" variant="ghost" className={backClass} onClick={onBack}>
                  <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
                  Back
                </Button>
              ) : previous ? (
                <Button asChild variant="ghost" className={backClass}>
                  <Link href={`/onboarding/${previous}`}>
                    <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
                    Back
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" className={cn(entryButton, 'px-6')} loading={saving} disabled={submitDisabled}>
                {submitLabel}
              </Button>
            </div>
          )}
        </form>
      </div>
      {state ? (
        <aside aria-label="What we know so far" className="sticky top-6 hidden w-menu shrink-0 flex-col gap-4 lg:flex">
          <BrandCard state={state} />
          {aside}
        </aside>
      ) : null}
    </div>
  );
}
