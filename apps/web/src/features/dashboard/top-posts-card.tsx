import { CardLink, DashboardCard } from './dashboard-card';
import { ChannelMark } from './channel-mark';
import type { TopPost } from './dashboard-types';
import { formatNumber, formatPercent } from './format';

export function TopPostsCard({ posts, sample }: { posts: TopPost[]; sample: boolean }) {
  return (
    <DashboardCard
      title="Top posts"
      description="Ranked by people reached in this period"
      sample={sample}
      action={<CardLink href="/analytics">All posts</CardLink>}
      className="lg:col-span-2"
    >
      <div className="-mx-4 overflow-x-auto md:-mx-6">
        <table className="w-full min-w-table text-left">
          <thead>
            <tr className="border-b border-line text-label text-ink-secondary">
              <th scope="col" className="h-control px-4 font-medium md:px-6">Post</th>
              <th scope="col" className="h-control px-4 font-medium">Format</th>
              <th scope="col" className="h-control px-4 text-right font-medium">People reached</th>
              <th scope="col" className="h-control px-4 text-right font-medium md:pr-6">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post, i) => (
              <tr key={post.id} className="border-b border-line transition-colors duration-fast ease-standard last:border-b-0 hover:bg-subtle">
                <td className="px-4 py-3 md:px-6">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-caption tabular-nums text-ink-tertiary">{i + 1}</span>
                    <ChannelMark channel={post.channel} />
                    <span className="text-label text-ink">{post.caption}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-body text-ink-secondary">{post.format}</td>
                <td className="px-4 py-3 text-right text-body tabular-nums text-ink">{formatNumber(post.reach)}</td>
                <td className="px-4 py-3 text-right text-body tabular-nums text-ink md:pr-6">
                  {formatPercent(post.engagementRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
