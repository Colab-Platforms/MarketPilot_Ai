'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  onboardingStepSchema,
  type OnboardingState,
  type OnboardingStep,
} from '@marketpilot/contracts';
import { Alert, Button, Skeleton } from '@marketpilot/ui';
import { BasicsStep } from './basics-step';
import { useOnboarding } from './onboarding-api';
import { QuestionStep } from './question-step';
import { ReviewStep } from './review-step';
import { TypeStep } from './type-step';

export function OnboardingLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading your setup</span>
      <Skeleton className="h-1 w-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-control w-full" />
    </div>
  );
}

export function OnboardingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <Alert tone="danger" title="We could not load your setup">
        Check your connection and try again.
      </Alert>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function firstIncomplete(state: OnboardingState): OnboardingStep {
  return state.steps.find((step) => !state.completedSteps.includes(step)) ?? 'goals';
}

function priorStepsDone(state: OnboardingState, step: OnboardingStep): boolean {
  const index = state.steps.indexOf(step);
  return index >= 0 && state.steps.slice(0, index).every((s) => state.completedSteps.includes(s));
}

export function StepScreen({ rawStep }: { rawStep: string }) {
  const router = useRouter();
  const query = useOnboarding();
  const parsed = onboardingStepSchema.safeParse(rawStep);
  const state = query.data;

  const redirectTo = !state
    ? null
    : !parsed.success
      ? `/onboarding/${firstIncomplete(state)}`
      : state.status === 'completed'
        ? '/home'
        : !priorStepsDone(state, parsed.data)
          ? `/onboarding/${firstIncomplete(state)}`
          : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (query.isError) return <OnboardingError onRetry={() => void query.refetch()} />;
  if (!state || redirectTo || !parsed.success) return <OnboardingLoading />;

  // Keyed on the track so switching account type remounts the forms with fresh questions.
  const key = `${parsed.data}-${state.track}`;
  switch (parsed.data) {
    case 'type':
      return <TypeStep key={key} state={state} />;
    case 'basics':
      return <BasicsStep key={key} state={state} />;
    case 'review':
      return <ReviewStep key={key} state={state} />;
    case 'about':
    case 'goals':
      return <QuestionStep key={key} step={parsed.data} state={state} />;
  }
}
