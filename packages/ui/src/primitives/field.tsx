import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface FieldProps {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

// Label above, helper below, error replaces helper. Wires id and aria attributes
// onto the single control passed as children.
export function Field({ label, helper, error, optional, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? helper;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {optional ? <span className="ml-1 text-ink-tertiary">(optional)</span> : null}
      </label>
      {control}
      {message ? (
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn('text-caption', error ? 'text-danger' : 'text-ink-secondary')}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function FieldGroup({ legend, helper, error, children }: { legend: string; helper?: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label text-ink">{legend}</legend>
      {helper && !error ? <p className="text-caption text-ink-secondary">{helper}</p> : null}
      {children}
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
