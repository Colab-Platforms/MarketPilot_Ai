import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const alertVariants = cva('rounded-md border px-4 py-3 text-body', {
  variants: {
    tone: {
      danger: 'border-danger bg-danger-subtle text-ink',
      success: 'border-success bg-success-subtle text-ink',
      info: 'border-info bg-info-subtle text-ink',
    },
  },
  defaultVariants: { tone: 'info' },
});

interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
}

// Errors are announced immediately; other tones politely.
export function Alert({ tone, title, className, children, ...props }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {title ? <p className="text-label">{title}</p> : null}
      {children ? <div className={title ? 'mt-1 text-ink-secondary' : undefined}>{children}</div> : null}
    </div>
  );
}
