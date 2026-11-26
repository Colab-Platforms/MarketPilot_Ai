import Link from 'next/link';
import { Button } from '@marketpilot/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from './logo';
import { Container, focusRing } from './section';

export const sectionLinks = [
  { href: '#how', label: 'How it works' },
  { href: '#controls', label: 'Your controls' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Questions' },
];

export function SiteHeader() {
  return (
    <header className="bg-canvas">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="MarketPilot home" className={`rounded-sm ${focusRing}`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-sm text-body font-medium text-ink-secondary transition-colors duration-fast ease-standard hover:text-ink ${focusRing}`}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="font-bold">
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </Container>
    </header>
  );
}
