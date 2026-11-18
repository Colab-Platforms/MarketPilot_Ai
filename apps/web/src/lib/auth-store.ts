import { create } from 'zustand';
import type { AuthContext, AuthSessionResponse } from '@marketpilot/contracts';

// The access token lives only in memory. The refresh token is an httpOnly cookie
// the browser never exposes to scripts.
interface AuthState {
  status: 'unknown' | 'authenticated' | 'anonymous';
  accessToken: string | null;
  context: AuthContext | null;
  setSession: (session: AuthSessionResponse) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  accessToken: null,
  context: null,
  setSession: ({ accessToken, ...context }) => set({ status: 'authenticated', accessToken, context }),
  clear: () => set({ status: 'anonymous', accessToken: null, context: null }),
}));
