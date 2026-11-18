import { errorEnvelopeSchema } from '@marketpilot/contracts';
import { useAuthStore } from './auth-store';
import { env } from './env';
import { refreshSession } from './session';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

interface SendOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  idempotencyKey?: string;
}

interface RequestOptions extends SendOptions {
  // Auth endpoints and public calls skip the bearer token and the 401 retry.
  anonymous?: boolean;
}

async function send(path: string, options: SendOptions, token: string | null): Promise<Response> {
  const { body, idempotencyKey, headers, ...rest } = options;
  return fetch(`${env.apiUrl}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function readFields(details: Record<string, unknown> | undefined): Record<string, string> {
  const fields = details?.fields;
  return fields && typeof fields === 'object' ? (fields as Record<string, string>) : {};
}

// The raw response, with the bearer token and one retry after a refresh on 401. Non-OK
// responses are thrown as ApiError, so callers only ever see a successful response.
export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { anonymous = false, ...sendOptions } = options;
  const token = anonymous ? null : useAuthStore.getState().accessToken;
  let response = await send(path, sendOptions, token);

  if (response.status === 401 && !anonymous) {
    const renewed = await refreshSession();
    if (renewed) response = await send(path, sendOptions, renewed.accessToken);
  }

  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(await response.json().catch(() => null));
    throw parsed.success
      ? new ApiError(
          parsed.data.error.code,
          parsed.data.error.message,
          response.status,
          readFields(parsed.data.error.details),
        )
      : new ApiError('internal_error', 'Something went wrong. Try again.', response.status);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
