'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@marketpilot/ui';
import { isNavActive, primaryNav } from './nav-items';

// The sidebar is hidden below the tablet width, so the same destinations live here.
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 border-t border-line bg-surface md:hidden"
    >
      {primaryNav.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-caption',
              active ? 'text-accent' : 'text-ink-secondary',
            )}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden />
            <span className="truncate">{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
