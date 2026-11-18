'use client';

import { Bell, BellOff } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@marketpilot/ui';

// No notification source exists yet, so the menu shows its empty state.
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Notifications" title="Notifications" className="w-control-sm px-0">
          <Bell className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-menu">
        <DropdownMenuLabel className="text-label text-ink">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <BellOff className="size-5 text-ink-tertiary" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-label text-ink">You are all caught up</p>
          <p className="text-caption text-ink-secondary">Approvals, publishing results and tips will show up here.</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
