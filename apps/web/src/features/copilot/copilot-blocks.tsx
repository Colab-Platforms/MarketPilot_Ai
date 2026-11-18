import { Check, Clock, ExternalLink, X } from 'lucide-react';
import { Badge, Button } from '@marketpilot/ui';
import type { ApprovalBlock, ApprovalStatus, SourcesBlock, UiBlock } from '@marketpilot/contracts';

export function SourcesList({ block }: { block: SourcesBlock }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-ink-tertiary">From your business</span>
      <ul className="flex flex-wrap gap-1">
        {block.items.map((item) => (
          <li key={`${item.title}|${item.url ?? ''}`}>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-0.5 text-caption text-ink-secondary hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {item.title}
                <ExternalLink className="size-3" strokeWidth={1.5} aria-hidden="true" />
              </a>
            ) : (
              <span className="inline-flex rounded-sm border border-line px-2 py-0.5 text-caption text-ink-secondary">
                {item.title}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS: Record<ApprovalStatus, { label: string; tone: 'neutral' | 'info' | 'accent' | 'success' | 'warning'; Icon: typeof Check }> = {
  pending: { label: 'Waiting for you', tone: 'info', Icon: Clock },
  approved: { label: 'Approved', tone: 'accent', Icon: Check },
  executed: { label: 'Done', tone: 'success', Icon: Check },
  rejected: { label: 'Rejected', tone: 'neutral', Icon: X },
  failed: { label: 'Failed', tone: 'warning', Icon: X },
};

interface ApprovalCardProps {
  block: ApprovalBlock;
  busy: boolean;
  onDecide(actionId: string, decision: 'approve' | 'reject'): void;
}

// DESIGN.md "Approval card": what will change, what it costs, then the decision.
export function ApprovalCard({ block, busy, onDecide }: ApprovalCardProps) {
  const status = STATUS[block.status];
  return (
    <section aria-label={block.title} className="flex flex-col gap-3 rounded-md border border-accent-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-label text-ink">{block.title}</h3>
          <p className="text-caption text-ink-secondary">{block.summary}</p>
        </div>
        <Badge tone={status.tone}>
          <status.Icon className="size-3" strokeWidth={1.5} aria-hidden="true" />
          {status.label}
        </Badge>
      </div>
      {block.changes.length > 0 && (
        <dl className="flex flex-col gap-2 text-caption">
          {block.changes.map((change) => (
            <div key={change.label} className="flex flex-col gap-0.5">
              <dt className="text-ink-tertiary">{change.label}</dt>
              {change.before && (
                <dd className="text-ink-tertiary line-through">
                  <span className="sr-only">Before: </span>
                  {change.before}
                </dd>
              )}
              <dd className="text-ink">
                <span className="sr-only">After: </span>
                {change.after ?? 'Cleared'}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {block.credits > 0 && <p className="text-caption text-ink-secondary">Uses {block.credits} credits</p>}
      {block.status === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => onDecide(block.actionId, 'approve')}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDecide(block.actionId, 'reject')}>
            Reject
          </Button>
        </div>
      )}
    </section>
  );
}

export function BlockView({ block, busy, onDecide }: { block: UiBlock } & Omit<ApprovalCardProps, 'block'>) {
  return block.type === 'sources' ? <SourcesList block={block} /> : <ApprovalCard block={block} busy={busy} onDecide={onDecide} />;
}
