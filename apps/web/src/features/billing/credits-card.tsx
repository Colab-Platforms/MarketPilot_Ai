import Link from 'next/link';
import { Coins } from 'lucide-react';
import { cn } from '@marketpilot/ui';

// Billing (M13) has no balance endpoint yet, so the balance reads zero until it lands.
export const CREDIT_BALANCE = 0;

export function CreditsCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex-col gap-3 rounded-md border border-line bg-subtle p-3', className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-sm bg-accent-subtle text-accent">
          <Coins className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <p className="text-caption text-ink-secondary">Credits left</p>
          <p className="text-label tabular-nums text-ink">{CREDIT_BALANCE}</p>
        </div>
      </div>
      <Link
        href="/settings#billing"
        className="flex h-control-sm items-center justify-center rounded-md bg-accent text-label text-accent-on transition-colors duration-fast ease-standard hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-subtle"
      >
        Top up credits
      </Link>
    </div>
  );
}

export function CreditsPill() {
  return (
    <Link
      href="/settings#billing"
      className="hidden h-control-sm items-center gap-2 rounded-full border border-line bg-surface px-3 text-label text-ink-secondary transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:inline-flex"
    >
      <Coins className="size-4 text-accent" strokeWidth={1.5} aria-hidden="true" />
      <span className="tabular-nums">{CREDIT_BALANCE} credits</span>
    </Link>
  );
}
