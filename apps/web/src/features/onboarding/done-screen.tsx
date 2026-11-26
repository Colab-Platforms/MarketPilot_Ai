'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Alert, Button, cn } from '@marketpilot/ui';
import { entryButton, entryTitle } from '@/features/identity/entry-styles';
import { ApiError } from '@/lib/api-client';
import { useCompleteOnboarding, useOnboarding } from './onboarding-api';
import { OnboardingError, OnboardingLoading } from './step-screen';

const NEXT_STEPS = [
  {
    title: 'Connect Instagram and Facebook',
    description: 'So we can post for you. It takes about a minute.',
    tag: 'Coming soon',
  },
  {
    title: 'Get your first month’s plan',
    description: 'We plan 30 days around festivals, the wedding season and your busy days.',
    tag: null,
  },
  {
    title: 'Approve your first posts',
    description: 'Nothing goes live until you say yes.',
    tag: null,
  },
];

export function DoneScreen() {
  const router = useRouter();
  const query = useOnboarding();
  const complete = useCompleteOnboarding();
  const [error, setError] = useState<string | null>(null);
  const state = query.data;

  const incomplete = !state || state.steps.some((step) => !state.completedSteps.includes(step));
  useEffect(() => {
    if (!state) return;
    if (state.status === 'completed') router.replace('/home');
    else if (incomplete) router.replace('/onboarding');
  }, [state, incomplete, router]);

  if (query.isError) return <OnboardingError onRetry={() => void query.refetch()} />;
  if (!state || state.status === 'completed' || incomplete) return <OnboardingLoading />;

  function onFinish() {
    setError(null);
    complete.mutate(undefined, {
      onSuccess: () => router.replace('/home'),
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.'),
    });
  }

  return (
    <div className="mx-auto flex max-w-content flex-col">
      <span className="mb-6 flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
        <Check className="size-8" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <h1 className={cn(entryTitle, 'text-display md:text-stat')}>You are all set, {state.brand.name}</h1>
      <p className="mt-2 text-lead text-ink-secondary">
        Your {state.track === 'creator' ? 'creator' : 'brand'} profile is saved. You can change anything later in Brand profile.
      </p>

      {error ? (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      ) : null}

      <h2 className="mb-3 mt-8 text-title font-semibold">Three steps to your first posts</h2>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {NEXT_STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-body font-bold">
              {index + 1}
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-heading font-semibold">{step.title}</span>
                {step.tag ? (
                  <span className="rounded-full bg-subtle px-2 text-caption font-medium text-ink-secondary">{step.tag}</span>
                ) : null}
              </span>
              <span className="text-body text-ink-secondary">{step.description}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-12 flex justify-end">
        <Button size="lg" className={cn(entryButton, 'px-6')} loading={complete.isPending} onClick={onFinish}>
          Go to my workspace
        </Button>
      </div>
    </div>
  );
}
