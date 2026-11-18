'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '../lib/cn';
import { ChartDataTable } from './chart-data-table';
import { compactNumber, evenlySpacedIndexes, niceMax, type DataPoint } from './scale';

interface TrendChartProps {
  data: DataPoint[];
  // Names the measure, for the tooltip and screen readers.
  seriesLabel: string;
  formatValue?: (value: number) => string;
  className?: string;
}

const X_TICKS = 5;

// Single-series area chart. The SVG stretches to fill its box, so anything that must keep its
// shape (the hover dot, labels, tooltip) is HTML positioned in percentages over it.
export function TrendChart({ data, seriesLabel, formatValue = compactNumber, className }: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length < 2) return null;

  const top = niceMax(Math.max(...data.map((d) => d.value)));
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `0,100 ${line} 100,100`;
  const point = active === null ? null : data[active];

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(fraction * (data.length - 1)))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setActive((current) => Math.max(0, Math.min(data.length - 1, (current ?? data.length - 1) + step)));
  }

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div
        role="img"
        tabIndex={0}
        aria-label={`${seriesLabel} trend. Use left and right arrow keys to read values.`}
        className="relative h-chart rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {[1, 0.5, 0].map((fraction) => (
          <div
            key={fraction}
            className="pointer-events-none absolute inset-x-0 border-t border-line"
            style={{ top: `${(1 - fraction) * 100}%` }}
          >
            {fraction > 0 ? (
              <span className="absolute left-0 top-1 text-caption tabular-nums text-ink-tertiary">
                {formatValue(top * fraction)}
              </span>
            ) : null}
          </div>
        ))}

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          <polygon points={area} className="fill-accent opacity-10" />
          <polyline
            points={line}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-accent"
          />
        </svg>

        {point && active !== null ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 border-l border-line-strong" style={{ left: `${x(active)}%` }} />
            <div
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
              style={{ left: `${x(active)}%`, top: `${y(point.value)}%` }}
            />
            <div
              role="status"
              className={cn(
                'pointer-events-none absolute top-0 z-10 rounded-sm border border-line bg-surface px-3 py-2 shadow-2',
                x(active) > 60 ? '-translate-x-full -ml-3' : 'ml-3',
              )}
              style={{ left: `${x(active)}%` }}
            >
              <div className="text-caption text-ink-secondary">{point.label}</div>
              <div className="text-label tabular-nums text-ink">
                {formatValue(point.value)} <span className="text-ink-secondary">{seriesLabel.toLowerCase()}</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="relative h-4" aria-hidden="true">
        {evenlySpacedIndexes(data.length, X_TICKS).map((i, n) => (
          <span
            key={i}
            className={cn(
              'absolute whitespace-nowrap text-caption text-ink-tertiary',
              n === 0 ? '' : n === X_TICKS - 1 ? '-translate-x-full' : '-translate-x-1/2',
            )}
            style={{ left: `${x(i)}%` }}
          >
            {data[i]?.label}
          </span>
        ))}
      </div>
      <ChartDataTable caption={seriesLabel} data={data} formatValue={formatValue} />
    </figure>
  );
}
