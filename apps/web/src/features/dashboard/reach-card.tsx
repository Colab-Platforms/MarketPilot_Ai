import { TrendChart, type DataPoint } from '@marketpilot/ui';
import { CardLink, DashboardCard } from './dashboard-card';
import { formatNumber } from './format';

interface ReachCardProps {
  data: DataPoint[];
  sample: boolean;
}

export function ReachCard({ data, sample }: ReachCardProps) {
  const peak = data.reduce<DataPoint | null>((best, d) => (best && best.value >= d.value ? best : d), null);
  const average = data.length > 0 ? Math.round(data.reduce((total, d) => total + d.value, 0) / data.length) : 0;

  return (
    <DashboardCard
      title="People reached"
      description="Unique accounts that saw your posts each day"
      sample={sample}
      action={<CardLink href="/analytics">Full report</CardLink>}
      className="lg:col-span-2"
    >
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-caption text-ink-secondary">Daily average</dt>
          <dd className="text-heading tabular-nums">{formatNumber(average)}</dd>
        </div>
        {peak ? (
          <div>
            <dt className="text-caption text-ink-secondary">Best day</dt>
            <dd className="text-heading tabular-nums">
              {formatNumber(peak.value)} <span className="text-caption font-normal text-ink-secondary">on {peak.label}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      <TrendChart data={data} seriesLabel="People reached" />
    </DashboardCard>
  );
}
