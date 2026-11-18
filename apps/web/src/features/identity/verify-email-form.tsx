'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { EMAIL_OTP_LENGTH, verifyEmailSchema } from '@marketpilot/contracts';
import { Alert, Button, Field, Input } from '@marketpilot/ui';
import { ApiError, apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { refreshSession, signOut } from '@/lib/session';

// A code was just sent when the account was created, so resend opens after this.
const INITIAL_COOLDOWN_SECONDS = 30;
const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailForm() {
  const router = useRouter();
  const user = useAuthStore((state) => state.context?.user);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(INITIAL_COOLDOWN_SECONDS);

  useEffect(() => {
    if (user?.emailVerified) router.replace('/onboarding');
  }, [user?.emailVerified, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest('/auth/email/verify', { method: 'POST', body: { code } });
      // The access token carries the verified flag, so trade for a fresh one.
      const session = await refreshSession();
      if (!session) throw new ApiError('unauthenticated', 'Sign in again to continue', 401);
    },
    onSuccess: () => router.replace('/onboarding'),
    onError: (error) => {
      if (error instanceof ApiError && error.fields.code) setCodeError(error.fields.code);
      else setNotice({ tone: 'danger', text: error instanceof ApiError ? error.message : 'Something went wrong. Try again.' });
    },
  });

  const resend = useMutation({
    mutationFn: () => apiRequest('/auth/email/resend', { method: 'POST' }),
    onSuccess: () => {
      setNotice({ tone: 'success', text: 'We sent a new code. Check your inbox and spam folder.' });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice({ tone: 'danger', text: error instanceof ApiError ? error.message : 'Something went wrong. Try again.' });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const parsed = verifyEmailSchema.safeParse({ code: new FormData(event.currentTarget).get('code') });
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message);
      return;
    }
    setCodeError(undefined);
    verify.mutate(parsed.data.code);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h1 className="text-display">Check your email</h1>
        <p className="mt-1 text-ink-secondary">
          We sent a {EMAIL_OTP_LENGTH}-digit code to <span className="text-ink">{user?.email ?? 'your email'}</span>. It
          expires in 10 minutes.
        </p>
      </div>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Field label="Verification code" error={codeError}>
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={EMAIL_OTP_LENGTH}
          pattern="[0-9]*"
          autoFocus
          onChange={() => setCodeError(undefined)}
        />
      </Field>

      <Button type="submit" size="lg" loading={verify.isPending}>
        Verify email
      </Button>

      <div className="flex flex-col items-center gap-2 text-ink-secondary">
        <Button
          variant="ghost"
          loading={resend.isPending}
          disabled={cooldown > 0}
          onClick={() => {
            setNotice(null);
            resend.mutate();
          }}
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </Button>
        <button
          type="button"
          className="text-accent underline underline-offset-2"
          onClick={() => void signOut().then(() => router.replace('/login'))}
        >
          Use a different account
        </button>
      </div>
    </form>
  );
}
