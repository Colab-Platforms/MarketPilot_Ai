import type { PrismaService } from '@/infra/prisma';
import { AuthService } from './auth.service';
import type { EmailOtpService } from './email-otp.service';
import type { GoogleProfile } from './google-oauth.service';
import type { PasswordService } from './password.service';
import type { RefreshSessionService } from './refresh-session.service';
import type { TokenService } from './token.service';

const profile: GoogleProfile = { sub: 'g-1', email: 'owner@example.com', emailVerified: true, name: 'Owner' };
const meta = { ipAddress: null, userAgent: null };
const workspace = { id: 'w1', name: 'W', accountType: 'business' as const, status: 'active' };

function build(users: { bySub?: object | null; byEmail?: object | null }) {
  const update = jest.fn(async ({ data }: { data: object }) => ({
    id: 'u1', email: profile.email, name: 'Owner', ...data,
  }));
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { googleSub?: string } }) =>
        where.googleSub ? (users.bySub ?? null) : (users.byEmail ?? null),
      ),
      update,
    },
    membership: { findFirst: jest.fn(async () => ({ role: 'owner', workspace })) },
  } as unknown as PrismaService;
  const sessions = { create: jest.fn(async () => ({ sessionId: 's1', token: 't', expiresAt: new Date() })) };
  const tokens = { sign: jest.fn(async () => 'access') };
  const service = new AuthService(
    prisma,
    {} as PasswordService,
    tokens as unknown as TokenService,
    sessions as unknown as RefreshSessionService,
    {} as EmailOtpService,
  );
  return { service, update };
}

describe('AuthService.signInWithGoogle', () => {
  it('refuses an unverified Google email', async () => {
    const { service } = build({});
    await expect(service.signInWithGoogle({ ...profile, emailVerified: false }, meta)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('signs in a returning Google user without touching the account', async () => {
    const { service, update } = build({ bySub: { id: 'u1', email: profile.email, name: 'Owner' } });
    const result = await service.signInWithGoogle(profile, meta);
    expect(result.body.accessToken).toBe('access');
    expect(update).not.toHaveBeenCalled();
  });

  it('drops the password when linking an account whose email was never verified', async () => {
    const { service, update } = build({
      byEmail: { id: 'u1', email: profile.email, name: 'Owner', passwordHash: 'x', emailVerifiedAt: null },
    });
    await service.signInWithGoogle(profile, meta);
    const data = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({ googleSub: 'g-1', passwordHash: null });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('keeps the password when linking an already verified account', async () => {
    const { service, update } = build({
      byEmail: { id: 'u1', email: profile.email, name: 'Owner', passwordHash: 'x', emailVerifiedAt: new Date() },
    });
    await service.signInWithGoogle(profile, meta);
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('passwordHash');
  });
});
