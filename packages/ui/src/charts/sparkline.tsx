import { cn } from '../lib/cn';

interface SparklineProps {
  values: number[];
  className?: string;
}

// A shape-only trend for stat tiles; the tile's number and delta carry the meaning.
export function Sparkline({ values, className }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${96 - ((v - min) / range) * 92}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('h-8 w-full overflow-visible text-accent', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
