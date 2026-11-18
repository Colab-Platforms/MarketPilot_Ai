import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { GoogleOAuthService } from './google-oauth.service';

function build(overrides: Partial<Env> = {}) {
  const values: Partial<Env> = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/v1/auth/google/callback',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    ...overrides,
  };
  const config = { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
  return new GoogleOAuthService(config);
}

describe('GoogleOAuthService', () => {
  it('is disabled until both credentials are set', () => {
    expect(build({ GOOGLE_CLIENT_SECRET: undefined }).enabled).toBe(false);
    expect(build().enabled).toBe(true);
  });

  it('builds a PKCE authorization URL whose state and challenge match the signed flow cookie', async () => {
    const service = build();
    const { url, flowCookie } = await service.begin();
    const params = new URL(url).searchParams;
    const flow = await service.readFlow(flowCookie);

    expect(params.get('state')).toBe(flow.state);
    expect(params.get('nonce')).toBe(flow.nonce);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBe(createHash('sha256').update(flow.verifier).digest('base64url'));
    expect(params.get('scope')).toBe('openid email profile');
  });

  it('rejects a missing or tampered flow cookie', async () => {
    const service = build();
    const { flowCookie } = await service.begin();
    await expect(service.readFlow(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(service.readFlow(`${flowCookie}x`)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a flow cookie signed with another key', async () => {
    const { flowCookie } = await build({ JWT_ACCESS_SECRET: 'b'.repeat(32) }).begin();
    await expect(build().readFlow(flowCookie)).rejects.toMatchObject({ status: 401 });
  });
});
