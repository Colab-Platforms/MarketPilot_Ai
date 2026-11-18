import { LlmError, type ToolCallRequest } from './llm.port';

interface StreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
}

interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

export interface StreamChunk {
  model?: string;
  choices?: { delta?: { content?: string | null; tool_calls?: ToolCallDelta[] }; finish_reason?: string | null }[];
  usage?: StreamUsage;
  error?: { message?: string; code?: number | string };
}

// Splits an SSE byte stream into JSON chunks. Comment lines (`: OPENROUTER PROCESSING`
// keep-alives) and the closing `[DONE]` are skipped.
export async function* readSseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        const chunk = parseLine(line);
        if (chunk) yield chunk;
        newline = buffer.indexOf('\n');
      }
    }
    const last = parseLine(buffer.trim());
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

function parseLine(line: string): StreamChunk | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data) as StreamChunk;
  } catch {
    throw new LlmError('upstream', 'The model gateway sent an unreadable stream event');
  }
}

// Folds streamed deltas into one assistant turn. Tool-call arguments arrive in fragments keyed
// by `index`; the id and name come only on a call's first fragment.
export class TurnAccumulator {
  content = '';
  finishReason = 'stop';
  model: string | null = null;
  usage: StreamUsage | undefined;
  private readonly calls = new Map<number, { id: string; name: string; arguments: string }>();

  // Returns the new answer text in this chunk, if any.
  add(chunk: StreamChunk): string {
    if (chunk.error) {
      throw new LlmError('upstream', `The model failed mid-answer${chunk.error.message ? `: ${chunk.error.message.slice(0, 160)}` : ''}`);
    }
    if (chunk.model) this.model = chunk.model;
    if (chunk.usage) this.usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) return '';
    if (choice.finish_reason) this.finishReason = choice.finish_reason;
    for (const delta of choice.delta?.tool_calls ?? []) this.addToolDelta(delta);
    const text = choice.delta?.content ?? '';
    this.content += text;
    return text;
  }

  toolCalls(): ToolCallRequest[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call)
      .filter((call) => call.name.length > 0);
  }

  private addToolDelta(delta: ToolCallDelta): void {
    const index = delta.index ?? 0;
    const call = this.calls.get(index) ?? { id: '', name: '', arguments: '' };
    if (delta.id) call.id = delta.id;
    if (delta.function?.name) call.name += delta.function.name;
    if (delta.function?.arguments) call.arguments += delta.function.arguments;
    this.calls.set(index, call);
  }
}
