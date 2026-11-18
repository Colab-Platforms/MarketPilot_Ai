'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Button, Card } from '@marketpilot/ui';
import { ApiError } from '@/lib/api-client';
import { useCompleteOnboarding, useOnboarding } from './onboarding-api';
import { OnboardingError, OnboardingLoading } from './step-screen';

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
    <div className="flex flex-col gap-6">
      <div>
        <CheckCircle2 className="mb-3 size-8 text-success" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="text-display">You are all set, {state.brand.name}</h1>
        <p className="mt-1 max-w-prose text-ink-secondary">
          We have saved what you told us. You can review and change it any time in settings.
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <h2 className="text-heading">What happens next</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-4 text-ink-secondary">
          <li>Your answers become your brand profile.</li>
          <li>Reading your website to fill in products and details is coming next.</li>
          <li>You approve everything before anything is posted.</li>
        </ul>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" loading={complete.isPending} onClick={onFinish}>
          Go to my workspace
        </Button>
      </div>
    </div>
  );
}
