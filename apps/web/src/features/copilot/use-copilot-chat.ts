import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { CopilotEvent, CopilotMessage, UiBlock } from '@marketpilot/contracts';
import { ApiError } from '@/lib/api-client';
import {
  conversationsKey,
  createConversation,
  streamDecision,
  streamMessage,
  useConversationMessages,
} from './copilot-api';
import { useCopilotStore } from './copilot-store';

export interface ToolStep {
  callId: string;
  label: string;
  state: 'running' | 'done' | 'failed';
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks: UiBlock[];
  steps: ToolStep[];
  state: 'streaming' | 'done' | 'stopped' | 'failed';
  error: string | null;
}

const fromMessage = (m: CopilotMessage): ChatTurn => ({ ...m, steps: [], state: 'done', error: null });

function newTurn(role: ChatTurn['role'], content: string, state: ChatTurn['state']): ChatTurn {
  return { id: crypto.randomUUID(), role, content, blocks: [], steps: [], state, error: null };
}

// Applies one server event to the reply being built.
function applyEvent(turn: ChatTurn, event: CopilotEvent): ChatTurn {
  switch (event.type) {
    case 'text.delta':
      return { ...turn, content: turn.content + event.text };
    case 'tool.started':
      return { ...turn, steps: [...turn.steps, { callId: event.callId, label: event.label, state: 'running' }] };
    case 'tool.finished':
      return {
        ...turn,
        steps: turn.steps.map((s) => (s.callId === event.callId ? { ...s, state: event.ok ? 'done' : 'failed' } : s)),
      };
    case 'ui.block':
    case 'approval.required':
      return { ...turn, blocks: [...turn.blocks, event.block] };
    case 'error':
      return { ...turn, state: 'failed', error: event.message };
    case 'done':
      return {
        ...turn,
        id: event.messageId ?? turn.id,
        state: event.outcome === 'cancelled' ? 'stopped' : turn.state === 'failed' || event.outcome === 'failed' ? 'failed' : 'done',
      };
    default:
      return turn;
  }
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The copilot could not be reached. Check your connection and try again.';
}

export function useCopilotChat() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const conversationId = useCopilotStore((s) => s.conversationId);
  const setConversation = useCopilotStore((s) => s.setConversation);
  const history = useConversationMessages(conversationId);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // History is read once per conversation; after that the chat's own state is the truth, so a
  // late history response can never overwrite a reply that is streaming.
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      syncedFor.current = null;
      setTurns([]);
      return;
    }
    if (syncedFor.current === conversationId || !history.data) return;
    syncedFor.current = conversationId;
    setTurns(history.data.messages.map(fromMessage));
  }, [conversationId, history.data]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (start: (signal: AbortSignal, onEvent: (event: CopilotEvent) => void) => Promise<void>) => {
      const reply = newTurn('assistant', '', 'streaming');
      setTurns((current) => [...current, reply]);
      setSuggestions([]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const update = (fn: (turn: ChatTurn) => ChatTurn) =>
        setTurns((current) => current.map((t) => (t.id === reply.id ? fn(t) : t)));
      let replyId = reply.id;
      try {
        await start(controller.signal, (event) => {
          if (event.type === 'suggestions') setSuggestions(event.items);
          update((turn) => {
            const next = applyEvent(turn, event);
            replyId = next.id;
            return next;
          });
        });
      } catch (error) {
        const stopped = controller.signal.aborted;
        setTurns((current) =>
          current.map((t) =>
            t.id === replyId ? { ...t, state: stopped ? 'stopped' : 'failed', error: stopped ? null : errorText(error) } : t,
          ),
        );
      } finally {
        setTurns((current) => current.map((t) => (t.id === replyId && t.state === 'streaming' ? { ...t, state: 'done' } : t)));
        setStreaming(false);
        abortRef.current = null;
        void queryClient.invalidateQueries({ queryKey: conversationsKey });
      }
    },
    [queryClient],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setTurns((current) => [...current, newTurn('user', trimmed, 'done')]);
      let id = conversationId;
      if (!id) {
        try {
          id = (await createConversation()).id;
          syncedFor.current = id;
          setConversation(id);
        } catch (error) {
          setTurns((current) => [...current, { ...newTurn('assistant', '', 'failed'), error: errorText(error) }]);
          return;
        }
      }
      const target = id;
      await run((signal, onEvent) =>
        streamMessage(target, { text: trimmed, page: { route: pathname } }, { signal, onEvent, idempotencyKey: crypto.randomUUID() }),
      );
    },
    [conversationId, pathname, run, setConversation, streaming],
  );

  const decide = useCallback(
    async (actionId: string, decision: 'approve' | 'reject') => {
      if (streaming) return;
      setTurns((current) =>
        current.map((t) => ({
          ...t,
          blocks: t.blocks.map((b) =>
            b.type === 'approval' && b.actionId === actionId ? { ...b, status: decision === 'approve' ? 'approved' : 'rejected' } : b,
          ),
        })),
      );
      await run((signal, onEvent) => streamDecision(actionId, { decision }, { signal, onEvent }));
    },
    [run, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const startNew = useCallback(() => {
    abortRef.current?.abort();
    setConversation(null);
    setTurns([]);
    setSuggestions([]);
  }, [setConversation]);

  return {
    turns,
    suggestions,
    streaming,
    loading: !!conversationId && history.isLoading,
    loadError: history.isError,
    retryLoad: () => void history.refetch(),
    send,
    decide,
    stop,
    startNew,
  };
}
