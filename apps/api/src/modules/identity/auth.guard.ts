import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@marketpilot/contracts';
import type { Request } from 'express';
import { DomainError } from '@/common';
import { ALLOW_UNVERIFIED_KEY } from './allow-unverified.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { TokenService } from './token.service';

// Registered globally: every route requires a valid access token unless marked @Public().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new DomainError(ErrorCode.Unauthenticated, 'Sign in to continue', 401);
    }
    const principal = await this.tokens.verify(token);
    const allowUnverified = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!principal.emailVerified && !allowUnverified) {
      throw new DomainError(ErrorCode.EmailNotVerified, 'Verify your email to continue', 403);
    }
    request.auth = principal;
    return true;
  }
}
