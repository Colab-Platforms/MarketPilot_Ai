import type { ReactNode } from 'react';
import { cn } from '@marketpilot/ui';
import { Logo } from './logo';

interface AppWindowProps {
  url: string;
  nav: readonly string[];
  activeNav: string;
  navBadge?: { item: string; count: number };
  sidebarFooter?: ReactNode;
  children: ReactNode;
  className?: string;
}

// A drawing of the product inside a browser frame. Purely illustrative, so it is hidden
// from assistive technology and made inert by the caller's figure.
export function AppWindow({ url, nav, activeNav, navBadge, sidebarFooter, children, className }: AppWindowProps) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-line bg-canvas shadow-window', className)}>
      <div className="flex h-control items-center gap-2 bg-subtle px-3">
        <span className="size-3 rounded-full bg-muted" />
        <span className="size-3 rounded-full bg-muted" />
        <span className="size-3 rounded-full bg-muted" />
        <span className="mx-auto rounded-sm bg-canvas px-8 py-1 text-caption text-ink-tertiary">{url}</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-tile shrink-0 flex-col gap-1 border-r border-line bg-surface px-2 py-4 text-label lg:flex">
          <Logo size="sm" className="px-2 pb-3" />
          {nav.map((item) => (
            <span
              key={item}
              className={cn(
                'flex justify-between rounded-sm px-2 py-2',
                item === activeNav ? 'bg-subtle font-bold text-ink' : 'text-ink-secondary',
              )}
            >
              {item}
              {navBadge?.item === item ? (
                <b className="rounded-full bg-highlight px-2 text-caption text-highlight-on">{navBadge.count}</b>
              ) : null}
            </span>
          ))}
          {sidebarFooter ? <div className="mt-auto">{sidebarFooter}</div> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}
