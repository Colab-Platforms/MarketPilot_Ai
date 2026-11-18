import {
  LlmError,
  LlmPort,
  type ChatMessage,
  type ConverseRequest,
  type ConverseResult,
  type EmbedRequest,
  type EmbedResult,
  type LlmUsage,
  type StructuredRequest,
  type StructuredResult,
} from './llm.port';
import { TurnAccumulator, readSseChunks } from './openrouter-stream';

export interface OpenRouterSettings {
  apiKey: string;
  baseUrl: string;
  strictPrivacy: boolean;
}

const DEFAULT_TIMEOUT_MS = 90_000;

interface ErrorBody {
  error?: { message?: string; code?: number | string };
}
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

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
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
    return this.settings.strictPrivacy ? { zdr: true, data_collection: 'deny' } : {};
  }

  private async post(path: string, body: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const response = await this.send(path, body, AbortSignal.timeout(timeoutMs));
    try {
      return await response.json();
    } catch {
      throw new LlmError('upstream', 'The model gateway returned an unreadable response');
    }
  }

  private async send(path: string, body: unknown, signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.settings.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.settings.apiKey}`,
          'content-type': 'application/json',
          'x-title': 'MarketPilot',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw abortError(error);
    }
    if (!response.ok) throw await toError(response);
    return response;
  }
}

// The owner pressing Stop aborts with AbortError, which is a cancellation, not a timeout.
function abortError(error: unknown): LlmError {
  // Checked by name: the abort error is a DOMException, which is not an Error in every runtime.
  const name = (error as { name?: string } | null)?.name;
  if (name === 'TimeoutError') return new LlmError('timeout', 'The model took too long to answer');
  if (name === 'AbortError') return new LlmError('cancelled', 'The request was cancelled');
  return new LlmError('upstream', 'Could not reach the model gateway');
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

// Error bodies can echo prompt text, so only status and the gateway's short message are kept.
async function toError(response: Response): Promise<LlmError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  const message = (body?.error?.message ?? '').slice(0, 160);
  switch (response.status) {
    case 401:
    case 403:
      return new LlmError('auth', 'The model gateway rejected the API key');
    case 402:
      return new LlmError('insufficient_credits', 'The model gateway account is out of credits');
    case 404:
      return new LlmError(
        'no_provider',
        `No provider meets the privacy and format requirements for this model${message ? `: ${message}` : ''}`,
      );
    case 429:
      return new LlmError('rate_limited', 'The model gateway is rate limiting requests');
    default:
      return new LlmError('upstream', `The model gateway failed with status ${response.status}`);
  }
}

function toUsage(model: string, usage: Usage | undefined): LlmUsage {
  return {
    model,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    costUsd: typeof usage?.cost === 'number' ? usage.cost : null,
  };
}

function parseJson(content: string): unknown {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError('invalid_output', 'The model returned text that is not valid JSON');
  }
}
