import { cn } from '../lib/cn';

interface ProgressProps {
  value: number;
  max: number;
  // Describes what is being measured, for screen readers.
  label: string;
  tone?: 'accent' | 'highlight';
  className?: string;
}

export function Progress({ value, max, label, tone = 'accent', className }: ProgressProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full', tone === 'highlight' ? 'bg-highlight' : 'bg-accent')}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
