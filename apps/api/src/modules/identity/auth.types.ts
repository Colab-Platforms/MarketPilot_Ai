import type { WorkspaceRole } from '@marketpilot/contracts';

export interface AuthPrincipal {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  sessionId: string;
  emailVerified: boolean;
}

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}
