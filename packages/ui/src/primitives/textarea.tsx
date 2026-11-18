import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlClasses } from './input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn('py-2', controlClasses, className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';
