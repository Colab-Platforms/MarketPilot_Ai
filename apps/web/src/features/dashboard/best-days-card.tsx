import { BarChart, type DataPoint } from '@marketpilot/ui';
import { DashboardCard } from './dashboard-card';

const FULL_DAY: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

export function BestDaysCard({ data, sample }: { data: DataPoint[]; sample: boolean }) {
  const best = data.reduce((top, d, i) => (d.value > (data[top]?.value ?? -1) ? i : top), 0);
  const bestLabel = data[best]?.label ?? '';

  return (
    <DashboardCard title="Best day to post" description="Average interactions per post, by weekday" sample={sample}>
      <p className="text-body text-ink-secondary">
        Your audience responds most on <span className="font-medium text-ink">{FULL_DAY[bestLabel] ?? bestLabel}</span>.
        We will lean your plan towards it.
      </p>
      <BarChart data={data} seriesLabel="Interactions per post" highlightIndex={best} />
    </DashboardCard>
  );
}
