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
import { Alert, Button, Field, Input, PasswordInput } from '@marketpilot/ui';
import { ApiError, apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { entryButton, entryInput, entryTitle } from './entry-styles';
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className={entryTitle}>Create your account</h1>
        <p className="text-balance text-lead text-ink-secondary">New here? We will set up your account in a minute.</p>
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label="Your name" error={errors.name}>
        <Input name="name" autoComplete="name" autoFocus className={entryInput} />
      </Field>
      <Field label="Email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@yourshop.in" className={entryInput} />
      </Field>
      <Field
        label="Password"
        helper={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={errors.password}
      >
        <PasswordInput name="password" autoComplete="new-password" className={entryInput} />
      </Field>

      <Button type="submit" size="lg" className={entryButton} loading={register.isPending}>
        Create account
      </Button>

      <OrDivider />
      <GoogleButton label="Sign up with Google" className={entryButton} />

      <p className="text-center text-body text-ink-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
