import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface ChoiceCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'title' | 'size'> {
  type: 'radio' | 'checkbox';
  title: string;
  description?: string;
  icon?: ReactNode;
  // `lg` is the roomy card of the setup flow: icon tile, round or square check mark.
  size?: 'md' | 'lg';
  // Shown next to the title, for example "Coming soon".
  badge?: ReactNode;
  // Extra content under the description (lg only).
  footer?: ReactNode;
}

const focus =
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas';

// A real radio or checkbox wrapped in a large target, so keyboard and screen
// readers behave natively. The selected state is shown by border and a check
// mark, not by colour alone.
export function ChoiceCard({ type, title, description, icon, size = 'md', badge, footer, className, ...props }: ChoiceCardProps) {
  if (size === 'lg') {
    return (
      <label
        className={cn(
          'relative flex cursor-pointer items-start gap-4 rounded-xl border border-line-strong bg-surface p-5 text-ink',
          'transition-colors duration-fast ease-standard hover:bg-subtle',
          'has-[:checked]:border-accent has-[:checked]:bg-accent-subtle',
          'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-line has-[:disabled]:bg-canvas has-[:disabled]:hover:bg-canvas',
          focus,
          className,
        )}
      >
        <input type={type} className="peer sr-only" {...props} />
        {icon ? (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink peer-disabled:text-ink-tertiary">
            {icon}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-1 peer-disabled:text-ink-tertiary">
          <span className="flex flex-wrap items-center gap-2 text-heading font-semibold">
            {title}
            {badge}
          </span>
          {description ? <span className="text-body text-ink-secondary">{description}</span> : null}
          {footer}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-6 shrink-0 items-center justify-center border-2 border-line-strong text-accent-on',
            'peer-checked:border-accent peer-checked:bg-accent peer-checked:[&>svg]:opacity-100 peer-disabled:hidden',
            type === 'radio' ? 'rounded-full' : 'rounded-sm',
          )}
        >
          <svg viewBox="0 0 16 16" className="size-4 opacity-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8.5 3.2 3L13 4.5" />
          </svg>
        </span>
      </label>
    );
  }

  return (
    <label
      className={cn(
        'relative flex min-h-touch cursor-pointer items-start gap-3 rounded-md border border-line bg-surface p-4',
        'transition-colors duration-fast ease-standard hover:bg-subtle',
        'has-[:checked]:border-accent has-[:checked]:bg-accent-subtle',
        focus,
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink-tertiary',
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...props} />
      {icon ? <span className="mt-0.5 text-ink-secondary">{icon}</span> : null}
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-label text-ink">{title}</span>
        {description ? <span className="text-caption text-ink-secondary">{description}</span> : null}
      </span>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-4 shrink-0 text-accent opacity-0 peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 8.5 3.2 3L13 4.5" />
      </svg>
    </label>
  );
}
