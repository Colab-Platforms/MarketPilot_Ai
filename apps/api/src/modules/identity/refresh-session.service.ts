import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@marketpilot/contracts';
import type { Env } from '@/config';
import { DomainError } from '@/common';
import { PrismaService } from '@/infra/prisma';
import type { RequestMeta } from './auth.types';

export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ROTATION_GRACE_MS = 10_000;

export interface IssuedRefresh {
  sessionId: string;
  token: string;
  expiresAt: Date;
}

export interface RotationResult {
  userId: string;
  workspaceId: string;
  sessionId: string;
  // Null when the request fell inside the grace window of an earlier rotation:
  // the client already holds the newer token from the winning response.
  rotated: IssuedRefresh | null;
}

function unauthenticated(): DomainError {
  return new DomainError(ErrorCode.Unauthenticated, 'Sign in again to continue', 401);
}

@Injectable()
export class RefreshSessionService {
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.pepper = config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  async create(userId: string, workspaceId: string, meta: RequestMeta): Promise<IssuedRefresh> {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        workspaceId,
        tokenHash: this.hashSecret(secret),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });
    return { sessionId: session.id, token: `${session.id}.${secret}`, expiresAt };
  }

  async rotate(token: string | undefined): Promise<RotationResult> {
    const parsed = this.parse(token);
    if (!parsed) throw unauthenticated();

    const session = await this.prisma.authSession.findUnique({ where: { id: parsed.sessionId } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw unauthenticated();

    const presented = this.hashSecret(parsed.secret);
    const identity = { userId: session.userId, workspaceId: session.workspaceId, sessionId: session.id };

    if (this.matches(presented, session.tokenHash)) {
      const rotated = await this.swapSecret(session.id, session.tokenHash);
      if (rotated) return { ...identity, rotated };
      // Lost a race against a concurrent refresh with the same token.
      return { ...identity, rotated: null };
    }

    const insideGrace =
      session.previousTokenHash !== null &&
      session.rotatedAt !== null &&
      Date.now() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS &&
      this.matches(presented, session.previousTokenHash);
    if (insideGrace) return { ...identity, rotated: null };

    await this.revoke(session.id);
    throw unauthenticated();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByToken(token: string | undefined): Promise<void> {
    const parsed = this.parse(token);
    if (parsed) await this.revoke(parsed.sessionId);
  }

  private async swapSecret(sessionId: string, currentHash: string): Promise<IssuedRefresh | null> {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const { count } = await this.prisma.authSession.updateMany({
      where: { id: sessionId, tokenHash: currentHash, revokedAt: null },
      data: {
        tokenHash: this.hashSecret(secret),
        previousTokenHash: currentHash,
        rotatedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt,
      },
    });
    return count === 1 ? { sessionId, token: `${sessionId}.${secret}`, expiresAt } : null;
  }

  private async revoke(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private parse(token: string | undefined): { sessionId: string; secret: string } | null {
    if (!token) return null;
    const separator = token.indexOf('.');
    if (separator < 1) return null;
    const sessionId = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuid.test(sessionId) && secret.length > 0 ? { sessionId, secret } : null;
  }

  private hashSecret(secret: string): string {
    return createHmac('sha256', this.pepper).update(secret).digest('hex');
  }

  private matches(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
