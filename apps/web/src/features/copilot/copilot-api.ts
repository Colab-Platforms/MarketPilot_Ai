import { useQuery } from '@tanstack/react-query';
import {
  conversationListSchema,
  conversationMessagesSchema,
  conversationResponseSchema,
  copilotEventSchema,
  type ApprovalDecisionInput,
  type ConversationMessages,
  type ConversationSummary,
  type CopilotEvent,
  type SendCopilotMessageInput,
} from '@marketpilot/contracts';
import { apiFetch, apiRequest } from '@/lib/api-client';

export const conversationsKey = ['copilot', 'conversations'] as const;
export const messagesKey = (id: string) => ['copilot', 'messages', id] as const;

export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: conversationsKey,
    enabled,
    queryFn: async (): Promise<ConversationSummary[]> =>
      conversationListSchema.parse(await apiRequest('/copilot/conversations')).conversations,
  });
}

// Loaded once per conversation; after that the chat keeps its own state while it streams.
export function useConversationMessages(id: string | null) {
  return useQuery({
    queryKey: messagesKey(id ?? 'none'),
    enabled: !!id,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ConversationMessages> =>
      conversationMessagesSchema.parse(await apiRequest(`/copilot/conversations/${id}/messages`)),
  });
}

export async function createConversation(): Promise<ConversationSummary> {
  return conversationResponseSchema.parse(await apiRequest('/copilot/conversations', { method: 'POST' })).conversation;
}

interface StreamOptions {
  signal: AbortSignal;
  onEvent: (event: CopilotEvent) => void;
  idempotencyKey?: string;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function stream(path: string, body: unknown, options: StreamOptions): Promise<void> {
  const response = await apiFetch(path, {
    method: 'POST',
    body,
    signal: options.signal,
    idempotencyKey: options.idempotencyKey,
    headers: { Accept: 'text/event-stream' },
  });
  if (!response.body) throw new Error('The reply could not be read.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (data) {
        const parsed = copilotEventSchema.safeParse(parseJson(data));
        if (parsed.success) options.onEvent(parsed.data);
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}

export function streamMessage(conversationId: string, input: SendCopilotMessageInput, options: StreamOptions) {
  return stream(`/copilot/conversations/${conversationId}/messages`, input, options);
}

export function streamDecision(actionId: string, input: ApprovalDecisionInput, options: StreamOptions) {
  return stream(`/copilot/actions/${actionId}/decision`, input, options);
}
