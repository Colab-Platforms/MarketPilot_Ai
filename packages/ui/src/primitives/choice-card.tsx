import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface ChoiceCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'title'> {
  type: 'radio' | 'checkbox';
  title: string;
  description?: string;
  icon?: ReactNode;
}

// A real radio or checkbox wrapped in a large target, so keyboard and screen
// readers behave natively. The selected state is shown by border and a check
// mark, not by colour alone.
export function ChoiceCard({ type, title, description, icon, className, ...props }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'relative flex min-h-touch cursor-pointer items-start gap-3 rounded-md border border-line bg-surface p-4',
        'transition-colors duration-fast ease-standard hover:bg-subtle',
        'has-[:checked]:border-accent has-[:checked]:bg-accent-subtle',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas',
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
