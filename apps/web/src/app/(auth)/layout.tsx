import { ThemeToggle } from '@/components/theme-toggle';
import { AuthGate } from '@/features/identity/auth-gate';
import { BrandMark } from '@/features/identity/brand-mark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4 md:px-8">
        <BrandMark />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-12 pt-8 md:items-center md:pt-0">
        <div className="w-full max-w-form">
          <AuthGate mode="guest">{children}</AuthGate>
        </div>
      </main>
    </div>
  );
}
