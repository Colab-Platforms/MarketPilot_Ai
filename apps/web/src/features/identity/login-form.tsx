'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authSessionResponseSchema, loginSchema } from '@marketpilot/contracts';
import { Alert, Button, Field, Input } from '@marketpilot/ui';
import { ApiError, apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { GOOGLE_ERRORS, GoogleButton, OrDivider } from './google-button';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export function LoginForm({ googleError }: { googleError?: string }) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    googleError ? (GOOGLE_ERRORS[googleError] ?? GOOGLE_ERRORS.failed ?? null) : null,
  );

  const login = useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      authSessionResponseSchema.parse(
        await apiRequest('/auth/login', { method: 'POST', body: input, anonymous: true }),
      ),
    onSuccess: (session) => {
      setSession(session);
      router.replace(session.user.emailVerified ? '/onboarding' : '/verify-email');
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.'),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: data.get('email'), password: data.get('password') });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    login.mutate(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h1 className="text-display">Sign in</h1>
        <p className="mt-1 text-ink-secondary">Welcome back.</p>
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <GoogleButton label="Continue with Google" />
      <OrDivider />

      <Field label="Email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" autoFocus />
      </Field>
      <Field label="Password" error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>

      <Button type="submit" size="lg" loading={login.isPending}>
        Sign in
      </Button>

      <p className="text-center text-ink-secondary">
        New here?{' '}
        <Link href="/register" className="text-accent underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}
