'use client';

import { Coins, Facebook, Instagram, MessageCircle, type LucideIcon } from 'lucide-react';
import { Avatar, Badge, Button, Card } from '@marketpilot/ui';
import { CREDIT_BALANCE } from '@/features/billing/credits-card';
import { useAuthStore } from '@/lib/auth-store';

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="flex scroll-mt-16 flex-col gap-5">
      <div>
        <h2 className="text-heading">{title}</h2>
        <p className="mt-1 text-caption text-ink-secondary">{description}</p>
      </div>
      {children}
    </Card>
  );
}

const CHANNELS: { label: string; icon: LucideIcon }[] = [
  { label: 'Instagram', icon: Instagram },
  { label: 'Facebook', icon: Facebook },
  { label: 'WhatsApp', icon: MessageCircle },
];

export function AccountSettings() {
  const context = useAuthStore((state) => state.context);
  if (!context) return null;

  return (
    <div className="flex flex-col gap-6">
      <Section id="profile" title="Your profile" description="How you appear to your team.">
        <div className="flex items-center gap-4">
          <Avatar name={context.user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-label text-ink">{context.user.name}</p>
            <p className="truncate text-caption text-ink-secondary">{context.user.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-secondary">Workspace</dt>
            <dd className="text-label text-ink">{context.workspace.name}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-secondary">Role</dt>
            <dd>
              <Badge tone="accent" className="capitalize">
                {context.role}
              </Badge>
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="channels" title="Channels" description="Accounts we publish to and read results from.">
        <ul className="flex flex-col">
          {CHANNELS.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
              <span className="flex size-8 items-center justify-center rounded-sm bg-subtle text-ink-secondary">
                <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="flex-1 text-label text-ink">{label}</span>
              <Badge>Coming soon</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="billing" title="Billing and credits" description="Credits pay for AI drafts, images and reels.">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-md bg-accent-subtle text-accent">
            <Coins className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-metric tabular-nums text-ink">{CREDIT_BALANCE}</p>
            <p className="text-caption text-ink-secondary">Credits left</p>
          </div>
          <Button variant="secondary" disabled>
            Top up (coming soon)
          </Button>
        </div>
      </Section>
    </div>
  );
}
