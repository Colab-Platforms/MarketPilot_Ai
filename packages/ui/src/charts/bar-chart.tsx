import { cn } from '../lib/cn';
import { ChartDataTable } from './chart-data-table';
import { compactNumber, niceMax, type DataPoint } from './scale';

interface BarChartProps {
  data: DataPoint[];
  seriesLabel: string;
  // Draws one bar in the full accent and the rest muted, to point at a single answer.
  highlightIndex?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

export function BarChart({ data, seriesLabel, highlightIndex, formatValue = compactNumber, className }: BarChartProps) {
  const top = niceMax(Math.max(...data.map((d) => d.value), 0));

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div className="relative h-chart-sm">
        {[1, 0.5].map((fraction) => (
          <div
            key={fraction}
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-line"
            style={{ top: `${(1 - fraction) * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end gap-0.5 border-b border-line">
          {data.map((d, i) => {
            const highlighted = highlightIndex === undefined || highlightIndex === i;
            return (
              <div
                key={d.label}
                tabIndex={0}
                aria-label={`${d.label}: ${formatValue(d.value)} ${seriesLabel.toLowerCase()}`}
                className="group relative flex h-full flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div
                  className={cn(
                    'w-full max-w-12 rounded-t-sm transition-colors duration-fast ease-standard',
                    highlighted ? 'bg-accent group-hover:bg-accent-hover' : 'bg-accent-line group-hover:bg-accent',
                  )}
                  style={{ height: `${(d.value / top) * 100}%` }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-sm border border-line bg-surface px-2 py-1 text-caption tabular-nums text-ink shadow-2 group-hover:block group-focus-visible:block"
                >
                  {d.label}: {formatValue(d.value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-0.5" aria-hidden="true">
        {data.map((d, i) => (
          <span
            key={d.label}
            className={cn('flex-1 text-center text-caption', highlightIndex === i ? 'text-ink' : 'text-ink-tertiary')}
          >
            {d.label}
          </span>
        ))}
      </div>
      <ChartDataTable caption={seriesLabel} data={data} formatValue={formatValue} />
    </figure>
  );
}
