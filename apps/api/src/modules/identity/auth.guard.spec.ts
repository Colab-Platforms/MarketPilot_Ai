import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllowUnverified } from './allow-unverified.decorator';
import { AuthGuard } from './auth.guard';
import type { TokenService } from './token.service';

const principal = { userId: 'u', workspaceId: 'w', role: 'owner' as const, sessionId: 's' };

class Routes {
  @AllowUnverified()
  verify() {}

  plain() {}
}

function contextFor(handler: () => void) {
  const request: { headers: Record<string, string>; auth?: unknown } = {
    headers: { authorization: 'Bearer t' },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AuthGuard email verification', () => {
  const guardFor = (emailVerified: boolean) =>
    new AuthGuard(
      new Reflector(),
       
      { verify: async () => ({ ...principal, emailVerified }) } as unknown as TokenService,
    );

  it('blocks an unverified account on a normal route', async () => {
    const { context } = contextFor(Routes.prototype.plain);
    await expect(guardFor(false).canActivate(context)).rejects.toMatchObject({ status: 403 });
  });

  it('lets an unverified account reach a route marked @AllowUnverified()', async () => {
    const { context, request } = contextFor(Routes.prototype.verify);
    await expect(guardFor(false).canActivate(context)).resolves.toBe(true);
    expect(request.auth).toBeDefined();
  });

  it('lets a verified account through', async () => {
    const { context } = contextFor(Routes.prototype.plain);
    await expect(guardFor(true).canActivate(context)).resolves.toBe(true);
  });
});
