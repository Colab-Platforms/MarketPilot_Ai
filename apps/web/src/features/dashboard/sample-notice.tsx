import Link from 'next/link';
import { PlugZap } from 'lucide-react';
import { Button } from '@marketpilot/ui';

export function SampleNotice() {
  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-md border border-dashed border-line-strong bg-surface p-4 sm:flex-row sm:items-center"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-info-subtle text-info">
        <PlugZap className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="flex-1 text-body text-ink-secondary">
        <span className="font-medium text-ink">You are looking at sample numbers.</span> Connect Instagram or Facebook
        and this page fills with your real reach, interactions and best posting times.
      </p>
      <Button asChild size="sm" variant="secondary" className="shrink-0">
        <Link href="/settings#channels">Connect a channel</Link>
      </Button>
    </div>
  );
}
