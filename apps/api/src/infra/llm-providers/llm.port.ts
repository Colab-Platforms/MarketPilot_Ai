export interface LlmUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  // As reported by the gateway, when it reports one.
  costUsd: number | null;
}

export interface StructuredRequest {
  // For logs only; never sent to the provider.
  task: string;
  model: string;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs?: number;
  // Lets the model read live web search results (ADR 0007). Only public business details
  // may go into a request that uses it.
  webSearch?: { maxResults: number; engine?: WebSearchEngine };
}

// `exa` searches at the gateway, so the model call keeps strict privacy routing; `native` uses
// the model provider's own search, which only some providers offer under that routing.
export type WebSearchEngine = 'exa' | 'native';

export interface StructuredResult {
  // Parsed JSON as returned. The caller must validate it; a provider cannot be trusted to follow the schema.
  data: unknown;
  usage: LlmUsage;
  // The URLs web search actually returned, which is what lets a caller reject anything the
  // model made up. Empty when web search was not used.
  sources: string[];
}

export interface EmbedRequest {
  task: string;
  model: string;
  inputs: string[];
  dimensions: number;
  timeoutMs?: number;
}

export interface EmbedResult {
  vectors: number[][];
  usage: LlmUsage;
}

export interface ToolCallRequest {
  id: string;
  // A provider-safe name (letters, digits, `_` and `-`); callers map their own names to it.
  name: string;
  // JSON text exactly as the model wrote it. The caller must parse and validate it.
  arguments: string;
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallRequest[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ConverseRequest {
  // For logs only; never sent to the provider.
  task: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  maxOutputTokens: number;
  // Receives answer text as it streams. Never called with tool-call arguments.
  onText?: (text: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ConverseResult {
  content: string;
  toolCalls: ToolCallRequest[];
  finishReason: string;
  usage: LlmUsage;
}

export type LlmFailure =
  | 'unavailable'
  | 'auth'
  | 'insufficient_credits'
  | 'no_provider'
  | 'rate_limited'
  | 'timeout'
  | 'invalid_output'
  | 'cancelled'
  | 'upstream';

export class LlmError extends Error {
  constructor(
    readonly reason: LlmFailure,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

// The only way application code reaches a model (ARCHITECTURE.md). Callers name a
// task through modules/ai; models are chosen by configuration, never by callers.
export abstract class LlmPort {
  // False when no provider is configured; callers then skip AI steps.
  abstract readonly available: boolean;
  abstract generateStructured(request: StructuredRequest): Promise<StructuredResult>;
  abstract embed(request: EmbedRequest): Promise<EmbedResult>;
  // One streamed chat turn that may end in tool calls instead of (or after) text.
  abstract converse(request: ConverseRequest): Promise<ConverseResult>;
}
