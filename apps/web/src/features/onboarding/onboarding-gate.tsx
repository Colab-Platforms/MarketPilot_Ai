'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingError, OnboardingLoading } from './step-screen';
import { useOnboarding } from './onboarding-api';

// The workspace is only usable once setup is finished.
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const query = useOnboarding();
  const status = query.data?.status;

  useEffect(() => {
    if (status && status !== 'completed') router.replace('/onboarding');
  }, [status, router]);

  if (query.isError) return <OnboardingError onRetry={() => void query.refetch()} />;
  if (status !== 'completed') return <OnboardingLoading />;
  return <>{children}</>;
}
