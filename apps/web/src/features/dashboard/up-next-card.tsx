import { Clock } from 'lucide-react';
import { Badge } from '@marketpilot/ui';
import { CardLink, DashboardCard } from './dashboard-card';
import { ChannelMark } from './channel-mark';
import type { UpcomingPost } from './dashboard-types';
import { formatWhen } from './format';

export function UpNextCard({ posts, sample }: { posts: UpcomingPost[]; sample: boolean }) {
  return (
    <DashboardCard
      title="Up next"
      description="Scheduled to go out automatically"
      sample={sample}
      action={<CardLink href="/calendar">Calendar</CardLink>}
    >
      {posts.length === 0 ? (
        <p className="text-body text-ink-secondary">Nothing scheduled yet. Plan your week from the calendar.</p>
      ) : (
        <ol className="flex flex-col">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
              <ChannelMark channel={post.channel} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-label text-ink">{post.title}</p>
                <p className="flex items-center gap-1 text-caption text-ink-secondary">
                  <Clock className="size-3" strokeWidth={1.5} aria-hidden="true" />
                  {formatWhen(post.scheduledFor)}
                </p>
              </div>
              <Badge tone="accent" className="hidden sm:inline-flex">
                {post.format}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}
