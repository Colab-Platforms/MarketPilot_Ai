import { cn } from '../lib/cn';

interface ProgressRingProps {
  percent: number;
  label: string;
  className?: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ percent, label, className }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('relative size-16 shrink-0', className)}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth={10} className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          className="stroke-accent transition-[stroke-dashoffset] duration-slow ease-standard"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-label tabular-nums text-ink">
        {clamped}%
      </span>
    </div>
  );
}
