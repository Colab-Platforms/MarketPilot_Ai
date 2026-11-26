import {
  LlmError,
  LlmPort,
  type ChatMessage,
  type ConverseRequest,
  type ConverseResult,
  type EmbedRequest,
  type EmbedResult,
  type StructuredRequest,
  type StructuredResult,
} from './llm.port';
import {
  DEFAULT_TIMEOUT_MS,
  abortError,
  postToOpenRouter,
  privacyOf,
  sendToOpenRouter,
  toUsage,
  type OpenRouterSettings,
  type OpenRouterUsage as Usage,
} from './openrouter-http';
import { TurnAccumulator, readSseChunks } from './openrouter-stream';

export type { OpenRouterSettings } from './openrouter-http';

interface Annotation {
  type?: string;
  url_citation?: { url?: string };
}

function citedUrls(annotations: Annotation[] | undefined): string[] {
  const urls = (annotations ?? []).flatMap((a) =>
    a.type === 'url_citation' && typeof a.url_citation?.url === 'string' ? [a.url_citation.url] : [],
  );
  return [...new Set(urls)];
}

export class OpenRouterAdapter extends LlmPort {
  readonly available = true;

  constructor(private readonly settings: OpenRouterSettings) {
    super();
  }

  async generateStructured(request: StructuredRequest): Promise<StructuredResult> {
    const body = {
      model: request.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      // No temperature: with require_parameters, any parameter an endpoint does not list
      // (newer Claude endpoints omit temperature) removes that endpoint from routing entirely.
      max_tokens: request.maxOutputTokens,
      response_format: {
        type: 'json_schema',
        json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
      },
      // Only providers that honour the schema, and (when strict) keep and train on nothing.
      provider: { require_parameters: true, ...this.privacy() },
      ...(request.webSearch && {
        plugins: [
          { id: 'web', engine: request.webSearch.engine ?? 'exa', max_results: request.webSearch.maxResults },
        ],
      }),
      usage: { include: true },
    };
    const json = (await this.post('/chat/completions', body, request.timeoutMs)) as {
      model?: string;
      choices?: {
        message?: { content?: string | null; annotations?: Annotation[] };
        finish_reason?: string;
      }[];
      usage?: Usage;
    };

    const choice = json.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new LlmError('invalid_output', 'The model ran out of output space before finishing');
    }
    const content = choice?.message?.content;
    if (!content) throw new LlmError('invalid_output', 'The model returned no content');

    return {
      data: parseJson(content),
      usage: toUsage(json.model ?? request.model, json.usage),
      sources: citedUrls(choice?.message?.annotations),
    };
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    const body = {
      model: request.model,
      input: request.inputs,
      dimensions: request.dimensions,
      encoding_format: 'float',
      provider: this.privacy(),
    };
    const json = (await this.post('/embeddings', body, request.timeoutMs)) as {
      model?: string;
      data?: { embedding?: number[]; index?: number }[];
      usage?: Usage;
    };

    const rows = [...(json.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors = rows.map((row) => row.embedding);
    const valid =
      vectors.length === request.inputs.length &&
      vectors.every((v): v is number[] => Array.isArray(v) && v.length === request.dimensions);
    // A model that ignores `dimensions` would silently corrupt the index, so refuse it.
    if (!valid) throw new LlmError('invalid_output', `Embeddings did not come back as ${request.dimensions} dimensions`);

    return { vectors: vectors as number[][], usage: toUsage(json.model ?? request.model, json.usage) };
  }

  async converse(request: ConverseRequest): Promise<ConverseResult> {
    const body = {
      model: request.model,
      messages: request.messages.map(toWireMessage),
      ...(request.tools.length > 0 && {
        tools: request.tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      }),
      max_tokens: request.maxOutputTokens,
      stream: true,
      // Only providers that support tool calling.
      provider: { ...(request.tools.length > 0 && { require_parameters: true }), ...this.privacy() },
      usage: { include: true },
    };
    const signal = withTimeout(request.signal, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const response = await this.send('/chat/completions', body, signal);
    if (!response.body) throw new LlmError('upstream', 'The model gateway returned an empty stream');

    const turn = new TurnAccumulator();
    try {
      for await (const chunk of readSseChunks(response.body)) {
        const text = turn.add(chunk);
        if (text) request.onText?.(text);
      }
    } catch (error) {
      throw error instanceof LlmError ? error : abortError(error);
    }
    if (turn.finishReason === 'error') throw new LlmError('upstream', 'The model failed mid-answer');

    return {
      content: turn.content,
      toolCalls: turn.toolCalls(),
      finishReason: turn.finishReason,
      usage: toUsage(turn.model ?? request.model, turn.usage),
    };
  }

  private privacy(): Record<string, unknown> {
    return privacyOf(this.settings);
  }

  private post(path: string, body: unknown, timeoutMs?: number): Promise<unknown> {
    return postToOpenRouter(this.settings, path, body, timeoutMs);
  }

  private send(path: string, body: unknown, signal: AbortSignal): Promise<Response> {
    return sendToOpenRouter(this.settings, path, body, signal);
  }
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function toWireMessage(message: ChatMessage): Record<string, unknown> {
  switch (message.role) {
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length && {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: call.arguments },
          })),
        }),
      };
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    default:
      return { role: message.role, content: message.content };
  }
}

function parseJson(content: string): unknown {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError('invalid_output', 'The model returned text that is not valid JSON');
  }
}
