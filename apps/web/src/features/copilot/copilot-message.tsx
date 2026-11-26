import { Check, X } from 'lucide-react';
import { Spinner, cn } from '@marketpilot/ui';
import { SentImages } from './copilot-attachments';
import { BlockView } from './copilot-blocks';
import { RichText } from './rich-text';
import type { ChatTurn, ToolStep } from './use-copilot-chat';

function StepLine({ step }: { step: ToolStep }) {
  return (
    <li className="flex items-center gap-2 text-caption text-ink-tertiary">
      {step.state === 'running' ? (
        <Spinner className="size-3" />
      ) : step.state === 'done' ? (
        <Check className="size-3 text-success" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <X className="size-3 text-danger" strokeWidth={1.5} aria-hidden="true" />
      )}
      <span>
        {step.label}
        {step.state === 'running' ? '...' : step.state === 'failed' ? ' (did not work)' : ''}
      </span>
    </li>
  );
}

interface MessageProps {
  turn: ChatTurn;
  busy: boolean;
  onDecide(actionId: string, decision: 'approve' | 'reject'): void;
}

export function CopilotMessage({ turn, busy, onDecide }: MessageProps) {
  if (turn.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-2">
        {turn.images && turn.images.length > 0 && <SentImages urls={turn.images} />}
        <p className="max-w-prose whitespace-pre-wrap rounded-md bg-accent-subtle px-3 py-2 text-body text-ink">{turn.content}</p>
      </div>
    );
  }

  const thinking = turn.state === 'streaming' && !turn.content && turn.steps.length === 0;
  return (
    <article className="flex flex-col gap-2 text-body text-ink">
      {turn.steps.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="What the copilot checked">
          {turn.steps.map((step) => (
            <StepLine key={step.callId} step={step} />
          ))}
        </ul>
      )}
      {thinking && (
        <p className="flex items-center gap-2 text-caption text-ink-tertiary">
          <Spinner className="size-3" />
          Thinking...
        </p>
      )}
      {turn.content && <RichText text={turn.content} />}
      {turn.blocks.map((block, i) => (
        <BlockView key={block.type === 'approval' ? block.actionId : i} block={block} busy={busy} onDecide={onDecide} />
      ))}
      {turn.state === 'stopped' && <p className="text-caption text-ink-tertiary">Stopped.</p>}
      {turn.error && (
        <p role="alert" className={cn('rounded-sm bg-danger-subtle px-3 py-2 text-caption text-ink')}>
          {turn.error}
        </p>
      )}
    </article>
  );
}
