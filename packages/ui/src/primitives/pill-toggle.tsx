import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface PillOption<T extends string> {
  value: T;
  label: ReactNode;
  // Needed when the visible label is shortened or decorated.
  ariaLabel?: string;
}

interface PillToggleProps<T extends string> {
  options: readonly PillOption<T>[];
  // null when nothing is picked yet.
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  // `joined` sits the pills in one rounded track; `chips` spaces them out as a filter row.
  layout?: 'joined' | 'chips';
  className?: string;
}

// Toggle buttons (aria-pressed) where exactly one is on. Each pill is its own tab stop,
// which suits short filter rows better than a roving radio group.
export function PillToggle<T extends string>({ options, value, onChange, label, layout = 'joined', className }: PillToggleProps<T>) {
  const joined = layout === 'joined';
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(joined ? 'inline-flex rounded-full border border-line bg-surface p-1' : 'flex flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-touch items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-body font-semibold',
              'transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
              pressed ? 'bg-ink text-surface' : 'text-ink-secondary hover:text-ink',
              !joined && (pressed ? 'border border-ink' : 'border border-line bg-surface text-ink'),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
