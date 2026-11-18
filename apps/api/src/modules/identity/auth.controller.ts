import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  type AuthContext,
  type AuthSessionResponse,
  type LoginInput,
  type RegisterInput,
  type VerifyEmailInput,
} from '@marketpilot/contracts';
import type { Request, Response } from 'express';
import type { Env } from '@/config';
import { ZodValidationPipe } from '@/common';
import type { AuthPrincipal } from './auth.types';
import { AuthService, type AuthResult } from './auth.service';
import { AllowUnverified } from './allow-unverified.decorator';
import { CurrentAuth } from './current-auth.decorator';
import { Public } from './public.decorator';
import {
  assertTrustedOrigin,
  clearRefreshCookie,
  readRefreshCookie,
  requestMeta,
  setRefreshCookie,
} from './refresh-cookie';

@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;
  private readonly webOrigin: string;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    return this.respond(response, await this.auth.register(body, requestMeta(request)));
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    return this.respond(response, await this.auth.login(body, requestMeta(request)));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    assertTrustedOrigin(request, this.webOrigin);
    try {
      return this.respond(response, await this.auth.refresh(readRefreshCookie(request)));
    } catch (error) {
      clearRefreshCookie(response, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    assertTrustedOrigin(request, this.webOrigin);
    await this.auth.logout(readRefreshCookie(request));
    clearRefreshCookie(response, this.secureCookies);
  }

  @AllowUnverified()
  @HttpCode(204)
  @Post('email/verify')
  async verifyEmail(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ): Promise<void> {
    await this.auth.verifyEmail(principal.userId, body.code);
  }

  @AllowUnverified()
  @HttpCode(204)
  @Post('email/resend')
  async resendVerification(@CurrentAuth() principal: AuthPrincipal): Promise<void> {
    await this.auth.resendVerification(principal.userId);
  }

  @AllowUnverified()
  @Get('me')
  me(@CurrentAuth() principal: AuthPrincipal): Promise<AuthContext> {
    return this.auth.me(principal.userId, principal.workspaceId);
  }

  private respond(response: Response, result: AuthResult): AuthSessionResponse {
    if (result.refresh) setRefreshCookie(response, result.refresh, this.secureCookies);
    return result.body;
  }
}
