import { AppShell } from '@/components/shell/app-shell';
import { AuthGate } from '@/features/identity/auth-gate';
import { OnboardingGate } from '@/features/onboarding/onboarding-gate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate mode="protected">
      <OnboardingGate>
        <AppShell>{children}</AppShell>
      </OnboardingGate>
    </AuthGate>
  );
}
