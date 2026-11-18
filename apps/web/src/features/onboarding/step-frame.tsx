import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ONBOARDING_STEPS, type OnboardingStep } from '@marketpilot/contracts';
import { Alert, Button, cn } from '@marketpilot/ui';
import { useOnboarding } from './onboarding-api';

const STEP_LABELS: Record<OnboardingStep, string> = {
  type: 'Account type',
  basics: 'The basics',
  review: 'Your website',
  about: 'About you',
  goals: 'Goals',
};

export function StepProgress({ current }: { current: OnboardingStep }) {
  // Which steps apply depends on the account (for example, only a business with a website is scanned).
  const steps = useOnboarding().data?.steps ?? ONBOARDING_STEPS;
  const index = steps.indexOf(current);
  return (
    <nav aria-label="Setup progress" className="mb-8">
      <p className="mb-2 text-caption text-ink-secondary">
        Step {index + 1} of {steps.length}: {STEP_LABELS[current]}
      </p>
      <ol className="flex gap-1">
        {steps.map((step, position) => (
          <li
            key={step}
            aria-current={step === current ? 'step' : undefined}
            className={cn('h-1 flex-1 rounded-full', position <= index ? 'bg-accent' : 'bg-muted')}
          >
            <span className="sr-only">{STEP_LABELS[step]}</span>
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
  children,
}: StepFrameProps) {
  const steps = useOnboarding().data?.steps ?? ONBOARDING_STEPS;
  const index = steps.indexOf(step);
  const previous = index > 0 ? steps[index - 1] : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <StepProgress current={step} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <div>
          <h1 className="text-display">{title}</h1>
          {description ? <p className="mt-1 max-w-prose text-ink-secondary">{description}</p> : null}
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex flex-col gap-4">{children}</div>

        <div className="flex items-center justify-between gap-3">
          {previous ? (
            <Button asChild variant="ghost">
              <Link href={`/onboarding/${previous}`}>
                <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Back
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={saving} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </>
  );
}
