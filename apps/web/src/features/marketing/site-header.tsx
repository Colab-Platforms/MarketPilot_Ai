import Link from 'next/link';
import { Navigation } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { Container, focusRing } from './section';

const links = [
  { href: '#what-it-does', label: 'What it does' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#control', label: 'Your controls' },
  { href: '#faq', label: 'Questions' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className={`flex items-center gap-2 rounded-sm text-heading ${focusRing}`}>
          <span className="flex size-8 items-center justify-center rounded-sm bg-accent text-accent-on">
            <Navigation className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </span>
          MarketPilot
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-sm text-label text-ink-secondary transition-colors duration-fast ease-standard hover:text-ink ${focusRing}`}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </Container>
    </header>
  );
}
