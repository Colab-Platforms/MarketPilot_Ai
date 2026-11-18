'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Plus, Sparkles, Square, X } from 'lucide-react';
import { MAX_COPILOT_MESSAGE_LENGTH } from '@marketpilot/contracts';
import { Alert, Button, Skeleton, cn } from '@marketpilot/ui';
import { useConversations } from './copilot-api';
import { CopilotMessage } from './copilot-message';
import { useCopilotStore } from './copilot-store';
import { useCopilotChat } from './use-copilot-chat';

const STARTERS = [
  'What is missing in my business profile?',
  'Who are my ideal customers?',
  'What does my website say about delivery?',
];

function EmptyState({ onPick }: { onPick(text: string): void }) {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex flex-col gap-1">
        <Sparkles className="size-5 text-accent" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-body text-ink">Ask anything about your business and your marketing.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {STARTERS.map((text) => (
          <li key={text}>
            <Button variant="secondary" size="sm" className="h-auto min-h-touch w-full justify-start py-2 text-left" onClick={() => onPick(text)}>
              {text}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CopilotPanel() {
  const open = useCopilotStore((s) => s.open);
  const setOpen = useCopilotStore((s) => s.setOpen);
  const conversationId = useCopilotStore((s) => s.conversationId);
  const setConversation = useCopilotStore((s) => s.setConversation);
  const chat = useCopilotChat();
  const recent = useConversations(open);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const resumed = useRef(false);

  // The first time the panel opens, carry on with the latest conversation.
  useEffect(() => {
    if (!open || resumed.current || conversationId || !recent.data) return;
    resumed.current = true;
    const latest = recent.data[0];
    if (latest) setConversation(latest.id);
  }, [open, conversationId, recent.data, setConversation]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const last = chat.turns[chat.turns.length - 1];
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [chat.turns.length, last?.content, last?.steps.length, last?.blocks.length]);

  const submit = (text: string) => {
    if (!text.trim() || chat.streaming) return;
    setDraft('');
    void chat.send(text);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };
  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };
  const startNew = () => {
    resumed.current = true;
    chat.startNew();
    inputRef.current?.focus();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink opacity-20 lg:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
      )}
      <aside
        id="copilot-panel"
        aria-label="Copilot"
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex h-sheet flex-col rounded-t-lg border-t border-line bg-surface shadow-3',
          'lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:h-auto lg:w-panel lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-2',
          !open && 'hidden',
        )}
      >
        <header className="flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <h2 className="flex items-center gap-2 text-heading text-ink">
            <Sparkles className="size-4 text-accent" strokeWidth={1.5} aria-hidden="true" />
            Copilot
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={startNew} disabled={chat.turns.length === 0 && !chat.streaming}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              New chat
            </Button>
            <Button variant="ghost" size="sm" className="w-control-sm px-0" aria-label="Close copilot" onClick={() => setOpen(false)}>
              <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div ref={logRef} role="log" aria-live="polite" aria-busy={chat.streaming} className="flex-1 overflow-y-auto px-4 py-4">
          {chat.loading ? (
            <div className="flex flex-col gap-3" aria-label="Loading conversation">
              <Skeleton className="ml-auto h-control w-tile" />
              <Skeleton className="h-chart-sm w-full" />
            </div>
          ) : chat.loadError ? (
            <Alert tone="danger" title="This conversation did not load">
              <Button variant="secondary" size="sm" className="mt-2" onClick={chat.retryLoad}>
                Try again
              </Button>
            </Alert>
          ) : chat.turns.length === 0 ? (
            <EmptyState onPick={submit} />
          ) : (
            <div className="flex flex-col gap-4">
              {chat.turns.map((turn) => (
                <CopilotMessage key={turn.id} turn={turn} busy={chat.streaming} onDecide={(id, d) => void chat.decide(id, d)} />
              ))}
              {chat.suggestions.length > 0 && !chat.streaming && (
                <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
                  {chat.suggestions.map((text) => (
                    <li key={text}>
                      <Button variant="secondary" size="sm" className="h-auto min-h-touch py-1 text-left" onClick={() => submit(text)}>
                        {text}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex shrink-0 items-end gap-2 border-t border-line p-3">
          <label htmlFor="copilot-input" className="sr-only">
            Message the copilot
          </label>
          <textarea
            id="copilot-input"
            ref={inputRef}
            rows={2}
            value={draft}
            maxLength={MAX_COPILOT_MESSAGE_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposerKey}
            placeholder="Ask about your business..."
            className="min-h-touch flex-1 resize-none rounded-sm border border-line bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {chat.streaming ? (
            <Button type="button" variant="secondary" className="w-control px-0" aria-label="Stop" onClick={chat.stop}>
              <Square className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" className="w-control px-0" aria-label="Send" disabled={!draft.trim()}>
              <ArrowUp className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          )}
        </form>
      </aside>
    </>
  );
}
