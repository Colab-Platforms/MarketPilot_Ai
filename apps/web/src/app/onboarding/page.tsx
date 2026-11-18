'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLoading, OnboardingError } from '@/features/onboarding/step-screen';
import { useOnboarding } from '@/features/onboarding/onboarding-api';

// Entry point after sign-in: send the owner to wherever they left off.
export default function OnboardingIndexPage() {
  const router = useRouter();
  const query = useOnboarding();
  const state = query.data;

  useEffect(() => {
    if (!state) return;
    if (state.status === 'completed') router.replace('/home');
    else router.replace(`/onboarding/${state.currentStep ?? 'type'}`);
  }, [state, router]);

  if (query.isError) return <OnboardingError onRetry={() => void query.refetch()} />;
  return <OnboardingLoading />;
}
