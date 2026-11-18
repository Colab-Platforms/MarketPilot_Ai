import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { ErrorCode } from '@marketpilot/contracts';
import type { Env } from '@/config';
import { DomainError } from '@/common';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const FLOW_TTL_SECONDS = 10 * 60;

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface FlowState {
  state: string;
  verifier: string;
  nonce: string;
}

const base64Url = (bytes: Buffer) => bytes.toString('base64url');

const failed = () => new DomainError(ErrorCode.Unauthenticated, 'Google sign-in failed', 401);

@Injectable()
export class GoogleOAuthService {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;
  private readonly flowKey: Uint8Array;
  private readonly jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    this.redirectUri = config.get('GOOGLE_REDIRECT_URI', { infer: true });
    this.flowKey = new TextEncoder().encode(config.get('JWT_ACCESS_SECRET', { infer: true }));
  }

  get enabled(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  // Authorization code flow with PKCE. The flow state travels in a signed,
  // short-lived cookie so the API stays stateless.
  async begin(): Promise<{ url: string; flowCookie: string; maxAgeMs: number }> {
    const flow: FlowState = {
      state: base64Url(randomBytes(24)),
      verifier: base64Url(randomBytes(48)),
      nonce: base64Url(randomBytes(24)),
    };
    const params = new URLSearchParams({
      client_id: this.clientId ?? '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: base64Url(createHash('sha256').update(flow.verifier).digest()),
      code_challenge_method: 'S256',
      // Always show the account chooser so a shared browser does not silently reuse an account.
      prompt: 'select_account',
    });
    const flowCookie = await new SignJWT({ ...flow })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(`${FLOW_TTL_SECONDS}s`)
      .sign(this.flowKey);
    return { url: `${AUTHORIZE_URL}?${params}`, flowCookie, maxAgeMs: FLOW_TTL_SECONDS * 1000 };
  }

  async readFlow(flowCookie: string | undefined): Promise<FlowState> {
    if (!flowCookie) throw failed();
    try {
      const { payload } = await jwtVerify(flowCookie, this.flowKey, { algorithms: ['HS256'] });
      const { state, verifier, nonce } = payload;
      if (typeof state !== 'string' || typeof verifier !== 'string' || typeof nonce !== 'string') {
        throw new Error('Malformed flow');
      }
      return { state, verifier, nonce };
    } catch {
      throw failed();
    }
  }

  async exchange(code: string, flow: FlowState): Promise<GoogleProfile> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId ?? '',
        client_secret: this.clientSecret ?? '',
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw failed();
    const { id_token: idToken } = (await response.json()) as { id_token?: string };
    if (!idToken) throw failed();
    return this.verifyIdToken(idToken, flow.nonce);
  }

  private async verifyIdToken(idToken: string, nonce: string): Promise<GoogleProfile> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: GOOGLE_ISSUERS,
        audience: this.clientId,
        algorithms: ['RS256'],
      });
      if (payload.nonce !== nonce) throw new Error('Nonce mismatch');
      if (!payload.sub || typeof payload.email !== 'string') throw new Error('Missing claims');
      const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null;
      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        name: name ?? payload.email.split('@')[0] ?? 'New user',
      };
    } catch {
      throw failed();
    }
  }
}
