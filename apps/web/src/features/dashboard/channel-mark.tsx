import { Facebook, Instagram, MessageCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@marketpilot/ui';
import type { Channel } from './dashboard-types';

const CHANNELS: Record<Channel, { label: string; icon: LucideIcon }> = {
  instagram: { label: 'Instagram', icon: Instagram },
  facebook: { label: 'Facebook', icon: Facebook },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
};

export function channelLabel(channel: Channel): string {
  return CHANNELS[channel].label;
}

export function ChannelMark({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = CHANNELS[channel].icon;
  return (
    <span
      title={CHANNELS[channel].label}
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-sm bg-subtle text-ink-secondary', className)}
    >
      <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only">{CHANNELS[channel].label}</span>
    </span>
  );
}
