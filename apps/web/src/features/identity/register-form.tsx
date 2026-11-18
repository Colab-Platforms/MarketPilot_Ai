'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  authSessionResponseSchema,
  PASSWORD_MIN_LENGTH,
  registerSchema,
} from '@marketpilot/contracts';
import { Alert, Button, Field, Input } from '@marketpilot/ui';
import { ApiError, apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { GoogleButton, OrDivider } from './google-button';

type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

export function RegisterForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) =>
      authSessionResponseSchema.parse(
        await apiRequest('/auth/register', { method: 'POST', body: input, anonymous: true }),
      ),
    onSuccess: (session) => {
      setSession(session);
      router.replace(session.user.emailVerified ? '/onboarding' : '/verify-email');
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields as FieldErrors);
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      name: data.get('name'),
      email: data.get('email'),
      password: data.get('password'),
    });
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
    register.mutate(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h1 className="text-display">Create your account</h1>
        <p className="mt-1 text-ink-secondary">It takes about two minutes to set up your workspace.</p>
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <GoogleButton label="Sign up with Google" />
      <OrDivider />

      <Field label="Your name" error={errors.name}>
        <Input name="name" autoComplete="name" autoFocus />
      </Field>
      <Field label="Email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" />
      </Field>
      <Field
        label="Password"
        helper={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={errors.password}
      >
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>

      <Button type="submit" size="lg" loading={register.isPending}>
        Create account
      </Button>

      <p className="text-center text-ink-secondary">
        Already have an account?{' '}
        <Link href="/login" className="text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
