import { LlmError, type LlmUsage } from './llm.port';

export interface OpenRouterSettings {
  apiKey: string;
  baseUrl: string;
  strictPrivacy: boolean;
}

export const DEFAULT_TIMEOUT_MS = 90_000;

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

interface ErrorBody {
  error?: { message?: string; code?: number | string };
}

// Zero-data-retention providers that do not train on inputs (ADR 0004).
export function privacyOf(settings: OpenRouterSettings): Record<string, unknown> {
  return settings.strictPrivacy ? { zdr: true, data_collection: 'deny' } : {};
}

export async function sendToOpenRouter(
  settings: OpenRouterSettings,
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${settings.apiKey}`,
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

export async function postToOpenRouter(
  settings: OpenRouterSettings,
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const response = await sendToOpenRouter(settings, path, body, AbortSignal.timeout(timeoutMs));
  try {
    return await response.json();
  } catch (error) {
    // A body cut off by the timeout reads as an abort, not as bad JSON.
    if ((error as { name?: string } | null)?.name === 'TimeoutError') throw abortError(error);
    throw new LlmError('upstream', 'The model gateway returned an unreadable response');
  }
}

export async function getFromOpenRouter(settings: OpenRouterSettings, path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${settings.apiKey}`, 'x-title': 'MarketPilot' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw abortError(error);
  }
  if (!response.ok) throw await toError(response);
  return response.json().catch(() => {
    throw new LlmError('upstream', 'The model gateway returned an unreadable response');
  });
}

// The owner pressing Stop aborts with AbortError, which is a cancellation, not a timeout.
export function abortError(error: unknown): LlmError {
  // Checked by name: the abort error is a DOMException, which is not an Error in every runtime.
  const name = (error as { name?: string } | null)?.name;
  if (name === 'TimeoutError') return new LlmError('timeout', 'The model took too long to answer');
  if (name === 'AbortError') return new LlmError('cancelled', 'The request was cancelled');
  return new LlmError('upstream', 'Could not reach the model gateway');
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

export function toUsage(model: string, usage: OpenRouterUsage | undefined): LlmUsage {
  return {
    model,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    costUsd: typeof usage?.cost === 'number' ? usage.cost : null,
  };
}
