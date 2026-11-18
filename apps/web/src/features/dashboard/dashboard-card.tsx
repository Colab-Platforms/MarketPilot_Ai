import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge, Card, cn } from '@marketpilot/ui';

interface DashboardCardProps {
  title: string;
  description?: string;
  sample?: boolean;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DashboardCard({ title, description, sample, action, className, children }: DashboardCardProps) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-heading">{title}</h2>
            {sample ? <SampleBadge /> : null}
          </div>
          {description ? <p className="mt-1 text-caption text-ink-secondary">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function SampleBadge() {
  return <Badge title="Illustrative numbers until your channels are connected">Sample</Badge>;
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-touch items-center gap-1 rounded-sm text-label text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0"
    >
      {children}
      <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </Link>
  );
}
