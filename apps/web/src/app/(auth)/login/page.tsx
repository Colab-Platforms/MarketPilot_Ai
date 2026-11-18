import type { Metadata } from 'next';
import { LoginForm } from '@/features/identity/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google } = await searchParams;
  return <LoginForm googleError={google} />;
}
