import { cn } from '../lib/cn';

interface ProgressProps {
  value: number;
  max: number;
  // Describes what is being measured, for screen readers.
  label: string;
  className?: string;
}

export function Progress({ value, max, label, className }: ProgressProps) {
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
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
