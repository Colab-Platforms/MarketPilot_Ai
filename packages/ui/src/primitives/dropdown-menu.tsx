'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

export const DropdownMenuContent = forwardRef<
  ComponentRef<typeof Menu.Content>,
  ComponentPropsWithoutRef<typeof Menu.Content>
>(({ className, sideOffset = 8, align = 'end', ...props }, ref) => (
  <Menu.Portal>
    <Menu.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        'z-50 min-w-menu overflow-hidden rounded-lg border border-line bg-surface p-1 text-ink shadow-2',
        className,
      )}
      {...props}
    />
  </Menu.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  ComponentRef<typeof Menu.Item>,
  ComponentPropsWithoutRef<typeof Menu.Item> & { tone?: 'default' | 'danger' }
>(({ className, tone = 'default', ...props }, ref) => (
  <Menu.Item
    ref={ref}
    className={cn(
      'flex min-h-touch cursor-pointer select-none items-center gap-3 rounded-sm px-3 text-label outline-none md:min-h-0 md:h-control-sm',
      'transition-colors duration-fast ease-standard data-[disabled]:pointer-events-none data-[disabled]:text-ink-tertiary',
      tone === 'danger'
        ? 'text-danger data-[highlighted]:bg-danger-subtle'
        : 'text-ink-secondary data-[highlighted]:bg-subtle data-[highlighted]:text-ink',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = forwardRef<
  ComponentRef<typeof Menu.Label>,
  ComponentPropsWithoutRef<typeof Menu.Label>
>(({ className, ...props }, ref) => (
  <Menu.Label ref={ref} className={cn('px-3 py-2', className)} {...props} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<
  ComponentRef<typeof Menu.Separator>,
  ComponentPropsWithoutRef<typeof Menu.Separator>
>(({ className, ...props }, ref) => (
  <Menu.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';
