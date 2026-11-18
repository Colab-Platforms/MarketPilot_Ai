import type { Metadata } from 'next';
import { RegisterForm } from '@/features/identity/register-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return <RegisterForm />;
}
