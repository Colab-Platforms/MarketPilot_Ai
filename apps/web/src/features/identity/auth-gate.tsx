'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@marketpilot/ui';
import { useAuthStore } from '@/lib/auth-store';
import { refreshSession } from '@/lib/session';

interface AuthGateProps {
  // `protected`: signed-in users only. `guest`: signed-out users only (login, register).
  mode: 'protected' | 'guest';
  // The verify-email page itself must stay reachable while unverified.
  allowUnverified?: boolean;
  children: React.ReactNode;
}

export function AuthGate({ mode, allowUnverified = false, children }: AuthGateProps) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const emailVerified = useAuthStore((state) => state.context?.user.emailVerified ?? false);
  const mustVerify = mode === 'protected' && status === 'authenticated' && !emailVerified && !allowUnverified;

  useEffect(() => {
    if (status === 'unknown') void refreshSession();
  }, [status]);

  useEffect(() => {
    if (mode === 'protected' && status === 'anonymous') router.replace('/login');
    if (mode === 'guest' && status === 'authenticated') router.replace('/onboarding');
    if (mustVerify) router.replace('/verify-email');
  }, [mode, status, mustVerify, router]);

  const allowed = mode === 'protected' ? status === 'authenticated' && !mustVerify : status === 'anonymous';
  if (!allowed) return <GateSkeleton />;
  return <>{children}</>;
}

function GateSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-8" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-control w-full" />
    </div>
  );
}
