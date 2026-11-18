import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { CreditsPill } from '@/features/billing/credits-card';
import { CopilotTrigger } from '@/features/copilot/copilot-trigger';
import { BrandLabel } from '@/features/identity/brand-label';
import { UserMenu } from '@/features/identity/user-menu';
import { NotificationsMenu } from './notifications-menu';

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-8">
      <BrandLabel />
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="hidden lg:inline-flex">
          <Link href="/create">
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Create post
          </Link>
        </Button>
        <CopilotTrigger />
        <CreditsPill />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
