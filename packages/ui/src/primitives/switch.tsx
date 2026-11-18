import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

// An on/off setting that takes effect at once (a checkbox is for choices saved with a form).
// Pair it with a visible label via `aria-labelledby`, or give it an `aria-label`.
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-control shrink-0 cursor-pointer items-center rounded-full p-0.5',
        'transition-colors duration-fast ease-standard',
        checked ? 'bg-accent' : 'bg-line-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-5 rounded-full bg-surface shadow-1 transition-transform duration-fast ease-standard',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  ),
);
Switch.displayName = 'Switch';
