'use client';

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

// A modal on the native <dialog>: the browser traps focus, closes on Escape and returns
// focus to the element that opened it.
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A click whose target is the <dialog> itself landed on the backdrop, outside the panel.
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onOpenChange(false);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={onClick}
      className={cn(
        'w-full max-w-content rounded-lg border border-line bg-surface p-0 text-ink shadow-3',
        'backdrop:bg-ink backdrop:opacity-20',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-heading">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-caption text-ink-secondary">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className={cn(
              'inline-flex h-control w-control shrink-0 items-center justify-center rounded-md text-ink-secondary',
              'transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-5" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {open ? children : null}
      </div>
    </dialog>
  );
}
