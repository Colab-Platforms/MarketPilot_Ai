import { ThemeToggle } from '@/components/theme-toggle';
import { AuthGate } from '@/features/identity/auth-gate';
import { BrandMark } from '@/features/identity/brand-mark';
import { UserMenu } from '@/features/identity/user-menu';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-4 md:px-8">
        <BrandMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="mx-auto w-full max-w-content">
          <AuthGate mode="protected">{children}</AuthGate>
        </div>
      </main>
    </div>
  );
}
