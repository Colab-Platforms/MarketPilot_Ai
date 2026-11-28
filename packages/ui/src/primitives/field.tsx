import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface FieldProps {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  // Keeps the label for screen readers when the same words are already shown just above.
  hideLabel?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

// Label above, helper below, error replaces helper. Wires id and aria attributes
// onto the single control passed as children.
export function Field({ label, helper, error, optional, hideLabel, className, children }: FieldProps) {
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
      <label htmlFor={id} className={cn('text-label text-ink', hideLabel && 'sr-only')}>
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

export function FieldGroup({
  legend,
  helper,
  error,
  hideLegend,
  children,
}: {
  legend: string;
  helper?: string;
  error?: string;
  hideLegend?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn('text-label text-ink', hideLegend && 'sr-only')}>{legend}</legend>
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
