import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ErrorCode } from '@marketpilot/contracts';
import type { Request } from 'express';
import { DomainError } from '@/common';
import type { AuthPrincipal } from './auth.types';

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal => {
  const principal = context.switchToHttp().getRequest<Request>().auth;
  if (!principal) throw new DomainError(ErrorCode.Unauthenticated, 'Sign in to continue', 401);
  return principal;
});
