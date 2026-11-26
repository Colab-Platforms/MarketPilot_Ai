import Link from 'next/link';
import { Send } from 'lucide-react';

export function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-sm text-heading font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-highlight text-highlight-on">
        <Send className="size-4" strokeWidth={2.2} aria-hidden="true" />
      </span>
      MarketPilot
    </Link>
  );
}
