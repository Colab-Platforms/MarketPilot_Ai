import type { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import type { Env } from '@/config';
import { TokenService } from './token.service';

const secret = 'a'.repeat(40);
const config = { get: () => secret } as unknown as ConfigService<Env, true>;
const principal = {
  userId: '0190aaaa-0000-7000-8000-000000000001',
  workspaceId: '0190aaaa-0000-7000-8000-000000000002',
  role: 'owner' as const,
  sessionId: '0190aaaa-0000-7000-8000-000000000003',
  emailVerified: true,
};

describe('TokenService', () => {
  const service = new TokenService(config);

  it('round-trips a principal', async () => {
    expect(await service.verify(await service.sign(principal))).toEqual(principal);
  });

  it('treats a token without the verified claim as unverified', async () => {
    const legacy = await new SignJWT({ wid: principal.workspaceId, role: 'owner', sid: principal.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(principal.userId)
      .setIssuer('marketpilot-api')
      .setAudience('marketpilot-web')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    expect((await service.verify(legacy)).emailVerified).toBe(false);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new SignJWT({ wid: principal.workspaceId, role: 'owner', sid: principal.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(principal.userId)
      .setIssuer('marketpilot-api')
      .setAudience('marketpilot-web')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('b'.repeat(40)));

    await expect(service.verify(forged)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ wid: principal.workspaceId, role: 'owner', sid: principal.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(principal.userId)
      .setIssuer('marketpilot-api')
      .setAudience('marketpilot-web')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(secret));

    await expect(service.verify(expired)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects garbage', async () => {
    await expect(service.verify('not-a-token')).rejects.toMatchObject({ status: 401 });
  });
});
