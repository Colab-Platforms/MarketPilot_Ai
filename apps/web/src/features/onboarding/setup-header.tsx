'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@marketpilot/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/features/marketing/logo';
import { signOut } from '@/lib/session';

// Every finished step is already saved, so leaving signs out and the owner resumes where they stopped.
export function SetupHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);

  async function exit() {
    setLeaving(true);
    await signOut();
    queryClient.clear();
    router.replace('/login');
  }

  return (
    <header className="border-b border-line bg-canvas">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4 md:px-8">
        <Link
          href="/"
          aria-label="MarketPilot home"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle className="size-12 rounded-lg border border-line" />
          <Button
            variant="secondary"
            className="min-h-touch rounded-lg bg-transparent font-semibold"
            title="Your finished steps are saved"
            loading={leaving}
            onClick={() => void exit()}
          >
            Exit setup
          </Button>
        </div>
      </div>
    </header>
  );
}
