'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navigation } from 'lucide-react';
import { cn } from '@marketpilot/ui';
import { CreditsCard } from '@/features/billing/credits-card';
import { isNavActive, navGroups, secondaryNav, type NavItem } from './nav-items';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cn(
        'relative flex h-control items-center justify-center gap-3 rounded-md text-body transition-colors duration-fast ease-standard xl:justify-start xl:px-3',
        focusRing,
        active
          ? 'bg-accent-subtle font-medium text-accent'
          : 'text-ink-secondary hover:bg-subtle hover:text-ink',
      )}
    >
      {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent" /> : null}
      <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only xl:not-sr-only">{item.label}</span>
    </Link>
  );
}

// A 64 px icon rail between tablet and 1280 px, the full 232 px rail above (DESIGN.md section 5).
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-rail shrink-0 flex-col border-r border-line bg-surface md:flex xl:w-sidebar">
      <Link
        href="/home"
        className={cn('flex h-topbar shrink-0 items-center justify-center gap-3 border-b border-line xl:justify-start xl:px-5', focusRing)}
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-on">
          <Navigation className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="sr-only text-heading text-ink xl:not-sr-only">MarketPilot</span>
      </Link>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="hidden px-3 pb-1 text-caption font-medium uppercase tracking-wide text-ink-tertiary xl:block">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-line px-3 py-4">
        <CreditsCard className="hidden xl:flex" />
        <nav aria-label="Secondary" className="flex flex-col gap-1">
          {secondaryNav.map((item) => (
            <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
