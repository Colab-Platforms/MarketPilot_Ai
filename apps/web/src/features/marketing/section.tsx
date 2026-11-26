import type { ReactNode } from 'react';
import { cn } from '@marketpilot/ui';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-page px-4 md:px-6', className)}>{children}</div>;
}

interface SectionIntroProps {
  titleId: string;
  title: ReactNode;
  description?: string;
  aside?: ReactNode;
}

// Heading on the left, a short description or a control on the right, wrapping on phones.
export function SectionIntro({ titleId, title, description, aside }: SectionIntroProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <h2 id={titleId} className="max-w-content text-balance font-display text-section">
        {title}
      </h2>
      {description ? <p className="max-w-form text-lead text-ink-secondary">{description}</p> : null}
      {aside}
    </div>
  );
}

export function Marker({ children }: { children: ReactNode }) {
  return <span className="mk-marker">{children}</span>;
}
