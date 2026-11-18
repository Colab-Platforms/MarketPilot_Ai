import Link from 'next/link';
import { Badge, Button } from '@marketpilot/ui';
import { DashboardCard } from './dashboard-card';
import { ChannelMark } from './channel-mark';
import type { PendingApproval } from './dashboard-types';
import { formatWhen } from './format';

// Approve and edit actions arrive with the approval flow; until then each draft opens in Create.
export function ApprovalsCard({ approvals, sample }: { approvals: PendingApproval[]; sample: boolean }) {
  return (
    <DashboardCard
      title="Needs your approval"
      description="Drafts waiting for a yes before they are scheduled"
      sample={sample}
      action={approvals.length > 0 ? <Badge tone="warning">{approvals.length} waiting</Badge> : null}
    >
      {approvals.length === 0 ? (
        <p className="text-body text-ink-secondary">You are all caught up. New drafts will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {approvals.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 rounded-md border border-line p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <ChannelMark channel={item.channel} />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-label text-ink">{item.caption}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-secondary">
                    <Badge tone="info">AI draft</Badge>
                    <span>{item.format}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatWhen(item.proposedFor)}</span>
                  </div>
                </div>
              </div>
              <Button asChild variant="secondary" size="sm" className="shrink-0">
                <Link href="/create">Review</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
