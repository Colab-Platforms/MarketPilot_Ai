import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, Sparkline, cn } from '@marketpilot/ui';
import type { Kpi } from './dashboard-types';
import { formatNumber, formatPercent } from './format';

const FLAT = 0.005;

function Delta({ value }: { value: number }) {
  const direction = value > FLAT ? 'up' : value < -FLAT ? 'down' : 'flat';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const words = direction === 'flat' ? 'No change' : `${direction === 'up' ? 'Up' : 'Down'} ${formatPercent(Math.abs(value))}`;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption tabular-nums',
        direction === 'up' && 'bg-success-subtle text-success',
        direction === 'down' && 'bg-danger-subtle text-danger',
        direction === 'flat' && 'bg-subtle text-ink-secondary',
      )}
    >
      <Icon className="size-3" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{words} versus the previous period</span>
      <span aria-hidden="true">{direction === 'flat' ? '0%' : formatPercent(Math.abs(value))}</span>
    </span>
  );
}

export function KpiTiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key numbers">
      {kpis.map((kpi) => (
        <li key={kpi.id}>
          <Card className="flex h-full flex-col gap-3 transition-shadow duration-fast ease-standard hover:shadow-1 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-label text-ink-secondary">{kpi.label}</h3>
              <Delta value={kpi.delta} />
            </div>
            <p className="text-metric tabular-nums text-ink">{formatNumber(kpi.value)}</p>
            <Sparkline values={kpi.trend} />
            <p className="text-caption text-ink-tertiary">{kpi.hint}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
