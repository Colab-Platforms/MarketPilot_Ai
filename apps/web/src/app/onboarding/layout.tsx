import { AuthGate } from '@/features/identity/auth-gate';
import { entryFontVariables } from '@/features/marketing/fonts';
import { SetupHeader } from '@/features/onboarding/setup-header';
import '@/features/marketing/marketing.css';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-surface="marketing"
      className={`${entryFontVariables} flex min-h-screen flex-col bg-canvas font-sans text-ink`}
    >
      <SetupHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-4 pb-16 pt-6 md:px-8 md:pt-12">
        <AuthGate mode="protected">{children}</AuthGate>
      </main>
    </div>
  );
}
