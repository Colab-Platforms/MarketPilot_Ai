import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { EmailOtpService } from './email-otp.service';
import { GoogleAuthController } from './google-auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { PasswordService } from './password.service';
import { RefreshSessionService } from './refresh-session.service';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    PasswordService,
    GoogleOAuthService,
    EmailOtpService,
    TokenService,
    RefreshSessionService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class IdentityModule {}
