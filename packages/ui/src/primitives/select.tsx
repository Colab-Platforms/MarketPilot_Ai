import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlClasses } from './input';

// Native select: best keyboard, screen-reader and mobile behaviour for short lists.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn('h-control', controlClasses, className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
