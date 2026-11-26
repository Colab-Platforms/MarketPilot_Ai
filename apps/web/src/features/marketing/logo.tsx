import { Send } from 'lucide-react';
import { cn } from '@marketpilot/ui';

interface LogoProps {
  size?: 'sm' | 'md';
  withWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 'md', withWordmark = true, className }: LogoProps) {
  return (
    <span className={cn('flex items-center font-display font-bold tracking-tight', size === 'md' ? 'gap-2 text-title' : 'gap-2 text-label', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center bg-highlight text-highlight-on',
          size === 'md' ? 'size-8 rounded-md' : 'size-5 rounded-sm',
        )}
      >
        <Send className={size === 'md' ? 'size-5' : 'size-3'} strokeWidth={2.2} />
      </span>
      {withWordmark ? 'MarketPilot' : null}
    </span>
  );
}
