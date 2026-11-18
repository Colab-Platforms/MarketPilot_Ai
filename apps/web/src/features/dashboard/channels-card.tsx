import { CardLink, DashboardCard } from './dashboard-card';
import { ChannelMark, channelLabel } from './channel-mark';
import type { ChannelShare } from './dashboard-types';
import { formatNumber, formatPercent } from './format';

export function ChannelsCard({ channels, sample }: { channels: ChannelShare[]; sample: boolean }) {
  const total = channels.reduce((sum, c) => sum + c.reach, 0);

  return (
    <DashboardCard
      title="Where people find you"
      description="Share of people reached, by channel"
      sample={sample}
      action={<CardLink href="/settings#channels">Manage</CardLink>}
    >
      <ul className="flex flex-col gap-4">
        {channels.map((c) => {
          const share = total > 0 ? c.reach / total : 0;
          return (
            <li key={c.channel} className="flex items-center gap-3">
              <ChannelMark channel={c.channel} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-label text-ink">{channelLabel(c.channel)}</span>
                  <span className="text-caption tabular-nums text-ink-secondary">
                    {formatNumber(c.reach)} · {formatPercent(share)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
                </div>
                <span className="text-caption text-ink-tertiary">{c.posts} posts</span>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
