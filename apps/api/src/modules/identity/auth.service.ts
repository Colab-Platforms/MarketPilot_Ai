import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type AuthContext,
  type AuthSessionResponse,
  type LoginInput,
  type RegisterInput,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { EmailOtpService } from './email-otp.service';
import { PrismaService } from '@/infra/prisma';
import type { RequestMeta } from './auth.types';
import type { GoogleProfile } from './google-oauth.service';
import { PasswordService } from './password.service';
import { RefreshSessionService, type IssuedRefresh } from './refresh-session.service';
import { ACCESS_TOKEN_TTL_SECONDS, TokenService } from './token.service';

export interface AuthResult {
  body: AuthSessionResponse;
  // Present only when a new refresh cookie must be set.
  refresh: IssuedRefresh | null;
}

const invalidCredentials = () =>
  new DomainError(ErrorCode.Unauthenticated, 'Email or password is incorrect', 401);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: RefreshSessionService,
    private readonly otp: EmailOtpService,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const { user, workspace } = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash },
        });
        const workspace = await tx.workspace.create({ data: { name: `${input.name}'s workspace` } });
        await tx.membership.create({
          data: { workspaceId: workspace.id, userId: user.id, role: 'owner' },
        });
        return { user, workspace };
      });
      await this.sendVerificationQuietly(user);
      return await this.startSession({ user, workspace, role: 'owner' }, meta);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const unclaimed = await this.prisma.user.findUnique({ where: { email: input.email } });
        // Nobody has proven they own an unverified address, so a new sign-up may take it over.
        if (unclaimed && !unclaimed.emailVerifiedAt && !unclaimed.googleSub) {
          return this.reclaimUnverified(unclaimed.id, input, passwordHash, meta);
        }
        throw new DomainError(
          ErrorCode.Conflict,
          'An account with this email already exists. Sign in instead.',
          409,
          { fields: { email: 'This email is already registered' } },
        );
      }
      throw error;
    }
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = await this.passwords.verify(user?.passwordHash ?? null, input.password);
    if (!user || !valid) throw invalidCredentials();
    return this.signInExisting(user, meta);
  }

  async signInWithGoogle(profile: GoogleProfile, meta: RequestMeta): Promise<AuthResult> {
    if (!profile.emailVerified) {
      throw new DomainError(ErrorCode.Forbidden, 'Your Google email address is not verified', 403);
    }
    try {
      const existing = await this.findOrLinkGoogleUser(profile);
      if (existing) return await this.signInExisting(existing, meta);
      return await this.createGoogleUser(profile, meta);
    } catch (error) {
      // Two simultaneous first sign-ins race on the unique email or sub; the loser signs in as the winner.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.findOrLinkGoogleUser(profile);
        if (winner) return this.signInExisting(winner, meta);
      }
      throw error;
    }
  }

  async refresh(token: string | undefined): Promise<AuthResult> {
    const rotation = await this.sessions.rotate(token);
    const context = await this.loadContext(rotation.userId, rotation.workspaceId);
    const accessToken = await this.tokens.sign({
      userId: rotation.userId,
      workspaceId: rotation.workspaceId,
      role: context.role,
      sessionId: rotation.sessionId,
      emailVerified: context.user.emailVerified,
    });
    return {
      body: { ...context, accessToken, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS },
      refresh: rotation.rotated,
    };
  }

  async verifyEmail(userId: string, code: string): Promise<void> {
    await this.otp.verify(userId, code);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;
    await this.otp.send(user);
  }

  logout(token: string | undefined): Promise<void> {
    return this.sessions.revokeByToken(token);
  }

  async me(userId: string, workspaceId: string): Promise<AuthContext> {
    return this.loadContext(userId, workspaceId);
  }

  private async reclaimUnverified(
    userId: string,
    input: RegisterInput,
    passwordHash: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name, passwordHash },
    });
    // Whoever held the account before must lose it, including their open sessions.
    await this.sessions.revokeAllForUser(userId);
    await this.sendVerificationQuietly(user);
    return this.signInExisting(user, meta);
  }

  // Registration succeeds even if the email fails or is rate limited; the user can resend.
  private async sendVerificationQuietly(user: { id: string; email: string; name: string }): Promise<void> {
    try {
      await this.otp.send(user);
    } catch (error) {
      this.logger.warn(`Verification email not sent: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  private async findOrLinkGoogleUser(profile: GoogleProfile) {
    const bySub = await this.prisma.user.findUnique({ where: { googleSub: profile.sub } });
    if (bySub) return bySub;

    const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (!byEmail) return null;

    // Password sign-up does not verify the email yet. If this account was never verified,
    // whoever registered it may not own the address, so their password is dropped on first
    // proof of ownership (Google). Verified accounts keep their password.
    return this.prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSub: profile.sub,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        ...(byEmail.emailVerifiedAt ? {} : { passwordHash: null }),
      },
    });
  }

  private async createGoogleUser(profile: GoogleProfile, meta: RequestMeta): Promise<AuthResult> {
    const { user, workspace } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleSub: profile.sub,
          emailVerifiedAt: new Date(),
        },
      });
      const workspace = await tx.workspace.create({ data: { name: `${profile.name}'s workspace` } });
      await tx.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role: 'owner' } });
      return { user, workspace };
    });
    return this.startSession({ user, workspace, role: 'owner' }, meta);
  }

  private async signInExisting(
    user: { id: string; email: string; name: string; emailVerifiedAt: Date | null },
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { workspace: true },
    });
    if (!membership || membership.workspace.status !== 'active') {
      throw new DomainError(ErrorCode.Forbidden, 'This account has no active workspace', 403);
    }
    return this.startSession({ user, workspace: membership.workspace, role: membership.role }, meta);
  }

  private async startSession(
    identity: {
      user: { id: string; email: string; name: string; emailVerifiedAt: Date | null };
      workspace: { id: string; name: string; accountType: 'creator' | 'business' };
      role: AuthContext['role'];
    },
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const refresh = await this.sessions.create(identity.user.id, identity.workspace.id, meta);
    const accessToken = await this.tokens.sign({
      userId: identity.user.id,
      workspaceId: identity.workspace.id,
      role: identity.role,
      sessionId: refresh.sessionId,
      emailVerified: identity.user.emailVerifiedAt !== null,
    });
    return {
      body: {
        user: {
          id: identity.user.id,
          email: identity.user.email,
          name: identity.user.name,
          emailVerified: identity.user.emailVerifiedAt !== null,
        },
        workspace: {
          id: identity.workspace.id,
          name: identity.workspace.name,
          accountType: identity.workspace.accountType,
        },
        role: identity.role,
        accessToken,
        expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      },
      refresh,
    };
  }

  private async loadContext(userId: string, workspaceId: string): Promise<AuthContext> {
    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { user: true, workspace: true },
    });
    if (!membership || membership.workspace.status !== 'active') {
      throw new DomainError(ErrorCode.Unauthenticated, 'Sign in again to continue', 401);
    }
    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        emailVerified: membership.user.emailVerifiedAt !== null,
      },
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        accountType: membership.workspace.accountType,
      },
      role: membership.role,
    };
  }
}
