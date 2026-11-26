import { AuthGate } from '@/features/identity/auth-gate';
import { EntryShell } from '@/features/identity/entry-shell';
import { entryFontVariables } from '@/features/marketing/fonts';
import '@/features/marketing/marketing.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="marketing" className={`${entryFontVariables} font-sans text-ink`}>
      <EntryShell>
        <AuthGate mode="guest">{children}</AuthGate>
      </EntryShell>
    </div>
  );
}
