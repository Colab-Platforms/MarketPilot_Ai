import Link from 'next/link';
import { Navigation } from 'lucide-react';
import { Container, focusRing } from './section';

const columns = [
  {
    heading: 'Product',
    links: [
      { href: '#what-it-does', label: 'What it does' },
      { href: '#how-it-works', label: 'How it works' },
      { href: '#control', label: 'Your controls' },
      { href: '#faq', label: 'Questions' },
    ],
  },
  {
    heading: 'Get started',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/login', label: 'Create my plan' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <Container className="py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="flex items-center gap-2 text-heading">
              <span className="flex size-8 items-center justify-center rounded-sm bg-accent text-accent-on">
                <Navigation className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </span>
              MarketPilot
            </p>
            <p className="mt-3 max-w-prose text-body text-ink-secondary">
              Posts, planning and results for local businesses, handled for you and approved by you.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-label text-ink">{column.heading}</p>
              <ul className="mt-3 grid list-none gap-2 p-0">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={`rounded-sm text-body text-ink-secondary transition-colors duration-fast ease-standard hover:text-ink ${focusRing}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-8 border-t border-line pt-6 text-caption text-ink-tertiary">
          © 2026 MarketPilot. Concept preview, not a live product. All examples are samples.
        </p>
      </Container>
    </footer>
  );
}
