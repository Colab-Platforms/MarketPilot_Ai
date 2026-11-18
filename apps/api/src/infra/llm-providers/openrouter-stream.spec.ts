import { LlmError } from './llm.port';
import { TurnAccumulator, readSseChunks, type StreamChunk } from './openrouter-stream';

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      parts.forEach((part) => controller.enqueue(encoder.encode(part)));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of readSseChunks(body)) chunks.push(chunk);
  return chunks;
}

describe('readSseChunks', () => {
  it('skips keep-alive comments and [DONE], and joins events split across reads', async () => {
    const chunks = await collect(
      streamOf(
        ': OPENROUTER PROCESSING\n\n',
        'data: {"choices":[{"delta":{"content":"Hel',
        'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" there"}}]}\n\n',
        'data: [DONE]\n\n',
      ),
    );
    expect(chunks.map((c) => c.choices?.[0]?.delta?.content)).toEqual(['Hello', ' there']);
  });

  it('rejects an unreadable event', async () => {
    await expect(collect(streamOf('data: {not json}\n\n'))).rejects.toBeInstanceOf(LlmError);
  });
});

describe('TurnAccumulator', () => {
  it('assembles tool calls from fragments keyed by index', () => {
    const turn = new TurnAccumulator();
    turn.add({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'brain__search', arguments: '{"que' } }] } }] });
    turn.add({ choices: [{ delta: { tool_calls: [{ index: 1, id: 'call_b', function: { name: 'profile__get', arguments: '{}' } }] } }] });
    turn.add({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"timings"}' } }] } }] });
    turn.add({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });

    expect(turn.toolCalls()).toEqual([
      { id: 'call_a', name: 'brain__search', arguments: '{"query":"timings"}' },
      { id: 'call_b', name: 'profile__get', arguments: '{}' },
    ]);
    expect(turn.finishReason).toBe('tool_calls');
  });

  it('reads usage from the final chunk that repeats the finish reason', () => {
    const turn = new TurnAccumulator();
    expect(turn.add({ model: 'anthropic/x', choices: [{ delta: { content: 'Hi' } }] })).toBe('Hi');
    turn.add({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] });
    turn.add({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.001 } });

    expect(turn.content).toBe('Hi');
    expect(turn.finishReason).toBe('stop');
    expect(turn.usage).toEqual({ prompt_tokens: 10, completion_tokens: 2, cost: 0.001 });
    expect(turn.model).toBe('anthropic/x');
  });

  it('throws on a mid-stream error chunk', () => {
    const turn = new TurnAccumulator();
    expect(() => turn.add({ error: { code: 502, message: 'provider down' }, choices: [{ finish_reason: 'error' }] })).toThrow(LlmError);
  });
});
