import type { ReactNode } from 'react';
import { cn } from '@marketpilot/ui';

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-page px-4 md:px-6 lg:px-8', className)}>{children}</div>
  );
}

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}

export function SectionHeading({ id, eyebrow, title, description, centered }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-content', centered && 'mx-auto text-center')}>
      <p className="text-label text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-display text-balance md:text-section">
        {title}
      </h2>
      {description ? <p className="mt-3 text-body text-ink-secondary">{description}</p> : null}
    </div>
  );
}

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';
