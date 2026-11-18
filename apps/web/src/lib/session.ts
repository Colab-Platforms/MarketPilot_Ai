import { authSessionResponseSchema, type AuthSessionResponse } from '@marketpilot/contracts';
import { useAuthStore } from './auth-store';
import { env } from './env';

let inflight: Promise<AuthSessionResponse | null> | null = null;

// Single-flight: concurrent callers (strict-mode double effects, parallel
// requests that all hit a 401) share one refresh call.
export function refreshSession(): Promise<AuthSessionResponse | null> {
  inflight ??= requestRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function requestRefresh(): Promise<AuthSessionResponse | null> {
  try {
    const response = await fetch(`${env.apiUrl}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!response.ok) throw new Error('refresh rejected');
    const session = authSessionResponseSchema.parse(await response.json());
    useAuthStore.getState().setSession(session);
    return session;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

export async function signOut(): Promise<void> {
  await fetch(`${env.apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
  useAuthStore.getState().clear();
}
