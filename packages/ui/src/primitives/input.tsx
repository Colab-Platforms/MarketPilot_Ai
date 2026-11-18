import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export const controlClasses = [
  'w-full rounded-sm border border-line bg-surface px-3 text-body text-ink',
  'placeholder:text-ink-tertiary',
  'transition-colors duration-fast ease-standard',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  'disabled:bg-muted disabled:text-ink-tertiary',
  'aria-[invalid=true]:border-danger',
];

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn('h-control', controlClasses, className)} {...props} />
  ),
);
Input.displayName = 'Input';
