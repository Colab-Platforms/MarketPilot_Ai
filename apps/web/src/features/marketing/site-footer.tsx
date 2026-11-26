import Link from 'next/link';
import { Logo } from './logo';
import { sectionLinks } from './site-header';
import { Container, focusRing } from './section';

// Only pages that exist today. Help, legal and social links join once those pages are live.
const columns = [
  { heading: 'Product', links: sectionLinks },
  {
    heading: 'Get started',
    links: [
      { href: '/register', label: 'Create an account' },
      { href: '/login', label: 'Sign in' },
    ],
  },
];

const payments = ['UPI', 'Cards', 'Net banking'];

export function SiteFooter() {
  return (
    <footer className="bg-canvas">
      <Container className="flex flex-col gap-12 pb-2 pt-16">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          <div className="flex max-w-form flex-col gap-4">
            <Link href="#top" aria-label="Back to top" className={`self-start rounded-sm ${focusRing}`}>
              <Logo />
            </Link>
            <p className="text-body text-ink-secondary">
              Marketing that takes off while you run the shop. Made in India, for India&apos;s local businesses.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:gap-x-16">
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
                <p className="text-caption font-bold uppercase tracking-widest text-ink-tertiary">{column.heading}</p>
                {column.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`self-start rounded-sm text-body text-ink-secondary transition-colors duration-fast ease-standard hover:text-ink ${focusRing}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-4 border-t border-line py-5 text-label text-ink-tertiary md:flex-row md:items-center">
          <span>© 2026 MarketPilot. Concept preview: every shop, post and number on this page is a sample.</span>
          <span className="flex flex-wrap items-center gap-2">
            Pay with
            {payments.map((method) => (
              <span key={method} className="rounded-sm border border-line px-2 py-1 font-semibold text-ink-secondary">
                {method}
              </span>
            ))}
            <span className="basis-full md:ml-1 md:basis-auto">GST invoice on every bill</span>
          </span>
        </div>
      </Container>
    </footer>
  );
}
