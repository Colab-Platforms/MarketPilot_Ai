import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { verifyEmailSchema } from '@marketpilot/contracts';
import type { Env } from '@/config';
import type { EmailPort, OutgoingEmail } from '@/infra/email';
import type { PrismaService } from '@/infra/prisma';
import { EmailOtpService, OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_HOUR } from './email-otp.service';

interface Row {
  id: string;
  userId: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// A small in-memory stand-in for the tables the service touches.
function build(options: { failSend?: boolean; env?: 'development' | 'production' } = {}) {
  const rows: Row[] = [];
  const user = { id: 'u1', email: 'a@example.com', name: 'Asha', emailVerifiedAt: null as Date | null };
  const matches = (row: Row, where: Record<string, any>) =>
    (where.id === undefined || row.id === where.id) &&
    (where.userId === undefined || row.userId === where.userId) &&
    (where.consumedAt !== null || row.consumedAt === null) &&
    (where.expiresAt === undefined || row.expiresAt > where.expiresAt.gt) &&
    (where.createdAt === undefined || row.createdAt > where.createdAt.gt) &&
    (where.attempts === undefined || row.attempts < where.attempts.lt);
  const emailOtp = {
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => {
        if (data.attempts) r.attempts += data.attempts.increment;
        if (data.consumedAt) r.consumedAt = data.consumedAt;
      });
      return { count: hit.length };
    },
    create: async ({ data }: any) => {
      const row = { id: `o${rows.length + 1}`, attempts: 0, consumedAt: null, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    findMany: async ({ where }: any) =>
      rows.filter((r) => matches(r, where)).sort((a, b) => +b.createdAt - +a.createdAt),
    findFirst: async ({ where }: any) => rows.filter((r) => matches(r, where)).at(-1) ?? null,
    delete: async ({ where }: any) => rows.splice(rows.findIndex((r) => r.id === where.id), 1),
  };
  const prisma = {
    emailOtp,
    user: {
      findUnique: async () => user,
      update: async ({ data }: any) => Object.assign(user, data),
    },
    $transaction: async (fn: any) => fn({ emailOtp }),
  } as unknown as PrismaService;
  const sent: OutgoingEmail[] = [];
  const email: EmailPort = {
    send: async (message) => {
      if (options.failSend) throw new Error('provider down');
      sent.push(message);
    },
  };
  const config = {
    get: (key: string) => (key === 'NODE_ENV' ? (options.env ?? 'production') : 'p'.repeat(40)),
  } as unknown as ConfigService<Env, true>;
  const service = new EmailOtpService(prisma, email, config);
  const lastCode = () => /(\d{6})/.exec(sent.at(-1)!.text)![1]!;
  // Move all rows into the past so the resend cooldown no longer applies.
  const age = (ms: number) => rows.forEach((r) => (r.createdAt = new Date(r.createdAt.getTime() - ms)));
  return { service, user, rows, sent, lastCode, age };
}

const otherThan = (code: string) => (code === '000000' ? '111111' : '000000');

describe('EmailOtpService', () => {
  it('sends a 6 digit code, stores only a hash, and verifies the email with it', async () => {
    const { service, user, rows, sent, lastCode } = build();
    await service.send(user);
    expect(sent).toHaveLength(1);
    expect(rows[0]!.codeHash).not.toContain(lastCode());
    await service.verify(user.id, lastCode());
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('rejects a wrong code and a reused code', async () => {
    const { service, user, lastCode } = build();
    await service.send(user);
    const code = lastCode();
    await expect(service.verify(user.id, otherThan(code))).rejects.toMatchObject({ status: 400 });
    await service.verify(user.id, code);
    user.emailVerifiedAt = null;
    await expect(service.verify(user.id, code)).rejects.toMatchObject({ status: 400 });
  });

  it('locks the code after too many wrong guesses, even for the right code', async () => {
    const { service, user, lastCode } = build();
    await service.send(user);
    const code = lastCode();
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(service.verify(user.id, otherThan(code))).rejects.toBeDefined();
    }
    await expect(service.verify(user.id, code)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an expired code', async () => {
    const { service, user, rows, lastCode } = build();
    await service.send(user);
    rows[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.verify(user.id, lastCode())).rejects.toMatchObject({ status: 400 });
  });

  it('invalidates the previous code when a new one is sent', async () => {
    const { service, user, sent, lastCode, age } = build();
    await service.send(user);
    const first = lastCode();
    age(61_000);
    await service.send(user);
    expect(sent).toHaveLength(2);
    if (first !== lastCode()) {
      await expect(service.verify(user.id, first)).rejects.toMatchObject({ status: 400 });
    }
    await service.verify(user.id, lastCode());
  });

  it('enforces the resend cooldown and the hourly cap', async () => {
    const { service, user, age } = build();
    await service.send(user);
    await expect(service.send(user)).rejects.toMatchObject({ status: 429 });
    for (let i = 1; i < OTP_MAX_SENDS_PER_HOUR; i++) {
      age(61_000);
      await service.send(user);
    }
    age(61_000);
    await expect(service.send(user)).rejects.toMatchObject({ status: 429 });
  });

  it('in development, a failed send keeps the code valid and prints it so the owner can type it in', async () => {
    const { service, user, rows } = build({ failSend: true, env: 'development' });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(service.send(user)).resolves.toBeUndefined();
    expect(rows).toHaveLength(1);
    const printed = String(warn.mock.calls.at(-1)?.[0]);
    expect(printed).toContain('DEV ONLY');
    await service.verify(user.id, /(\d{6})$/.exec(printed)![1]!);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    warn.mockRestore();
  });

  it('in production, a failed send never prints the code, removes it and reports 503', async () => {
    const { service, user, rows } = build({ failSend: true, env: 'production' });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(service.send(user)).rejects.toMatchObject({ status: 503 });
    expect(rows).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('removes the code and reports 503 when the provider fails', async () => {
    const { service, user, rows } = build({ failSend: true });
    await expect(service.send(user)).rejects.toMatchObject({ status: 503 });
    expect(rows).toHaveLength(0);
  });
});

describe('verifyEmailSchema', () => {
  it('accepts exactly six digits, ignoring surrounding spaces', () => {
    expect(verifyEmailSchema.safeParse({ code: '569313' }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ code: ' 000123 ' }).success).toBe(true);
  });

  it('rejects anything else', () => {
    for (const code of ['12345', '1234567', 'abcdef', 'dddddd', '12 456', '']) {
      expect(verifyEmailSchema.safeParse({ code }).success).toBe(false);
    }
  });
});
