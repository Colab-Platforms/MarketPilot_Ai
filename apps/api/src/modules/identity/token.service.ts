import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode, workspaceRoleSchema } from '@marketpilot/contracts';
import { jwtVerify, SignJWT } from 'jose';
import type { Env } from '@/config';
import { DomainError } from '@/common';
import type { AuthPrincipal } from './auth.types';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

const ISSUER = 'marketpilot-api';
const AUDIENCE = 'marketpilot-web';

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(config: ConfigService<Env, true>) {
    this.key = new TextEncoder().encode(config.get('JWT_ACCESS_SECRET', { infer: true }));
  }

  sign(principal: AuthPrincipal): Promise<string> {
    return new SignJWT({ wid: principal.workspaceId, role: principal.role, sid: principal.sessionId, ev: principal.emailVerified })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(principal.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<AuthPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      const role = workspaceRoleSchema.parse(payload.role);
      if (!payload.sub || typeof payload.wid !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('Malformed claims');
      }
      return {
        userId: payload.sub,
        workspaceId: payload.wid,
        role,
        sessionId: payload.sid,
        emailVerified: payload.ev === true,
      };
    } catch {
      throw new DomainError(ErrorCode.Unauthenticated, 'Sign in again to continue', 401);
    }
  }
}
