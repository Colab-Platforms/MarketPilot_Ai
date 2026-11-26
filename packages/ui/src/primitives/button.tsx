import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';
import { Spinner } from './spinner';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-label',
    'transition-colors duration-fast ease-standard',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    'disabled:pointer-events-none disabled:bg-muted disabled:text-ink-tertiary',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-on hover:bg-accent-hover',
        secondary: 'border border-line bg-surface text-ink hover:bg-subtle',
        ghost: 'text-ink-secondary hover:bg-subtle hover:text-ink',
        danger: 'bg-danger text-accent-on hover:opacity-90',
      },
      size: {
        sm: 'h-control-sm px-3',
        md: 'h-control px-4',
        lg: 'h-control-lg px-6',
        // Marketing calls to action only.
        xl: 'h-control-xl rounded-lg px-6 text-heading font-bold',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, type = 'button', children, disabled, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size }), className);
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }
    // Loading keeps the label in the layout (hidden) so the button never changes width.
    return (
      <button
        ref={ref}
        type={type}
        className={cn(classes, 'relative')}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
        {loading ? <Spinner className="absolute" /> : null}
      </button>
    );
  },
);
Button.displayName = 'Button';
