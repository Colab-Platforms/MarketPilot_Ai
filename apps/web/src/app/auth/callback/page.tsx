'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@marketpilot/ui';
import { refreshSession } from '@/lib/session';

// Google returns through the API, which sets the refresh cookie and lands here.
// The access token is memory-only, so trade the cookie for one, then continue.
export default function GoogleCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    void refreshSession().then((session) => {
      router.replace(session ? '/onboarding' : '/login?google=failed');
    });
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-form flex-col justify-center gap-4 px-4" role="status" aria-live="polite">
      <span className="sr-only">Signing you in</span>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-control w-full" />
    </main>
  );
}
