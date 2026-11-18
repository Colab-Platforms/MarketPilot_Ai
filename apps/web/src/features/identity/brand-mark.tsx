import Link from 'next/link';
import { Navigation } from 'lucide-react';

export function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-sm text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <span className="flex size-8 items-center justify-center rounded-sm bg-accent text-accent-on">
        <Navigation className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </span>
      MarketPilot
    </Link>
  );
}
