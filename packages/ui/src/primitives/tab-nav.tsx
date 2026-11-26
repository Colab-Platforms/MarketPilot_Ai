import type { ComponentType, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface TabNavItem {
  label: string;
  href: string;
  current: boolean;
}

interface LinkProps {
  href: string;
  className?: string;
  'aria-current'?: 'page';
  children: ReactNode;
}

interface TabNavProps {
  items: readonly TabNavItem[];
  label: string;
  // The app's link component (next/link), so tabs navigate without a full reload.
  linkComponent?: ComponentType<LinkProps> | 'a';
  className?: string;
}

// Links between sibling pages drawn like a segmented control. Unlike SegmentedControl it is
// navigation, so each tab is a real link and the current one is marked for assistive tech.
export function TabNav({ items, label, linkComponent: Link = 'a', className }: TabNavProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'inline-flex h-control-sm items-center gap-0.5 rounded-md bg-subtle p-0.5',
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          className={cn(
            'flex h-full items-center rounded-sm px-3 text-label transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            item.current ? 'bg-surface text-ink shadow-1' : 'text-ink-secondary hover:text-ink',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
