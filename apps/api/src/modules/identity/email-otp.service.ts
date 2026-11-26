import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_OTP_LENGTH, ErrorCode } from '@marketpilot/contracts';
import type { Env } from '@/config';
import { DomainError } from '@/common';
import { EmailPort } from '@/infra/email';
import { PrismaService } from '@/infra/prisma';
import { verificationEmail } from './otp-email';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_HOUR = 5;

const invalidCode = () =>
  new DomainError(ErrorCode.Validation, 'That code is incorrect or has expired', 400, {
    fields: { code: 'That code is incorrect or has expired' },
  });

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private readonly pepper: string;
  private readonly production: boolean;
  readonly required: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailPort,
    config: ConfigService<Env, true>,
  ) {
    this.pepper = `email-otp:${config.get('JWT_REFRESH_SECRET', { infer: true })}`;
    this.production = config.get('NODE_ENV', { infer: true }) === 'production';
    this.required = config.get('EMAIL_VERIFICATION_REQUIRED', { infer: true }) !== false;
  }

  async send(user: { id: string; email: string; name: string }): Promise<void> {
    const now = new Date();
    await this.assertWithinLimits(user.id, now);

    const code = String(randomInt(0, 10 ** EMAIL_OTP_LENGTH)).padStart(EMAIL_OTP_LENGTH, '0');
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.emailOtp.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.emailOtp.create({
        data: {
          userId: user.id,
          codeHash: this.hash(user.id, code),
          expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
        },
      });
    });

    try {
      await this.email.send(verificationEmail(user.email, user.name, code, OTP_TTL_MINUTES));
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Email send failed');
      if (!this.production) {
        // Development only: the email provider may be in test mode, so print the code here
        // and keep it valid. This branch can never run in production.
        this.logger.warn(`DEV ONLY: email not sent. Verification code for ${user.email} is ${code}`);
        return;
      }
      await this.prisma.emailOtp.delete({ where: { id: row.id } });
      throw new DomainError(ErrorCode.Internal, 'We could not send the email. Try again shortly.', 503);
    }
  }

  // Resolves when the email is verified, including when it already was.
  async verify(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw invalidCode();
    if (user.emailVerifiedAt) return;

    const otp = await this.prisma.emailOtp.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw invalidCode();

    // Claim an attempt before comparing so concurrent guesses cannot exceed the cap.
    const claimed = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0 || !this.matches(otp.codeHash, this.hash(userId, code))) throw invalidCode();

    const consumed = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) throw invalidCode();
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }

  private async assertWithinLimits(userId: string, now: Date): Promise<void> {
    const recent = await this.prisma.emailOtp.findMany({
      where: { userId, createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0]?.createdAt;
    const waitMs = last ? last.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000 - now.getTime() : 0;
    if (waitMs > 0) {
      throw new DomainError(ErrorCode.RateLimited, 'Wait a moment before requesting another code', 429, {
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }
    if (recent.length >= OTP_MAX_SENDS_PER_HOUR) {
      throw new DomainError(ErrorCode.RateLimited, 'Too many codes requested. Try again in an hour.', 429, {
        retryAfterSeconds: 3600,
      });
    }
  }

  private hash(userId: string, code: string): string {
    return createHmac('sha256', this.pepper).update(`${userId}:${code}`).digest('hex');
  }

  private matches(expected: string, actual: string): boolean {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  }
}
