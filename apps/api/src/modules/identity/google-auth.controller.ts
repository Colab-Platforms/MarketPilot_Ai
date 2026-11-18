import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '@/config';
import { DomainError } from '@/common';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { Public } from './public.decorator';
import { requestMeta, setRefreshCookie } from './refresh-cookie';

const FLOW_COOKIE = 'mp_oauth';

type FailureReason = 'unavailable' | 'cancelled' | 'failed' | 'unverified';

@Controller('auth/google')
export class GoogleAuthController {
  private readonly secureCookies: boolean;
  private readonly webOrigin: string;

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOAuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  @Public()
  @Get('start')
  async start(@Res() response: Response): Promise<void> {
    if (!this.google.enabled) return this.fail(response, 'unavailable');
    const { url, flowCookie, maxAgeMs } = await this.google.begin();
    response.cookie(FLOW_COOKIE, flowCookie, { ...this.flowCookieOptions(), maxAge: maxAgeMs });
    response.redirect(url);
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const flowCookie = (request.cookies as Record<string, unknown> | undefined)?.[FLOW_COOKIE];
    response.clearCookie(FLOW_COOKIE, this.flowCookieOptions());

    if (error) return this.fail(response, error === 'access_denied' ? 'cancelled' : 'failed');
    if (!this.google.enabled) return this.fail(response, 'unavailable');
    if (!code || !state) return this.fail(response, 'failed');

    try {
      const flow = await this.google.readFlow(typeof flowCookie === 'string' ? flowCookie : undefined);
      if (flow.state !== state) return this.fail(response, 'failed');
      const profile = await this.google.exchange(code, flow);
      const result = await this.auth.signInWithGoogle(profile, requestMeta(request));
      if (result.refresh) setRefreshCookie(response, result.refresh, this.secureCookies);
      response.redirect(`${this.webOrigin}/auth/callback`);
    } catch (caught) {
      this.fail(response, caught instanceof DomainError && caught.status === 403 ? 'unverified' : 'failed');
    }
  }

  private fail(response: Response, reason: FailureReason): void {
    response.redirect(`${this.webOrigin}/login?google=${reason}`);
  }

  private flowCookieOptions(): CookieOptions {
    // Lax: Google returns here by a top-level GET, which Lax cookies accompany.
    return { httpOnly: true, sameSite: 'lax', secure: this.secureCookies, path: '/v1/auth/google' };
  }
}
