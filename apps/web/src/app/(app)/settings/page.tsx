import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { AccountSettings } from '@/features/identity/account-settings';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-content">
      <PageHeader title="Settings" description="Your profile, channels and billing." />
      <AccountSettings />
    </div>
  );
}
