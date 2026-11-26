import { CircleCheck, Lightbulb } from 'lucide-react';
import type { ReelStatus } from '@marketpilot/contracts';
import { Badge, Spinner } from '@marketpilot/ui';

const WORKING: Partial<Record<ReelStatus, string>> = {
  ideating: 'Finding ideas',
  storyboarding: 'Writing storyboard',
};

export function ReelStatusChip({ status }: { status: ReelStatus }) {
  const working = WORKING[status];
  if (working) {
    return (
      <Badge tone="info">
        <Spinner className="size-3" />
        {working}
      </Badge>
    );
  }
  if (status === 'storyboard_ready') {
    return (
      <Badge tone="success">
        <CircleCheck className="size-3" strokeWidth={1.5} aria-hidden="true" />
        Storyboard ready
      </Badge>
    );
  }
  return (
    <Badge tone="accent">
      <Lightbulb className="size-3" strokeWidth={1.5} aria-hidden="true" />
      Pick an idea
    </Badge>
  );
}
