import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

// A native checkbox, so keyboard and screen readers work without extra code.
// Pair it with a visible label; wrap both in a `min-h-touch` row for a 44px target.
export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-5 shrink-0 cursor-pointer rounded-sm accent-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';
