'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CreditCard, IdCard, LogOut, Moon, Settings, UserRound } from 'lucide-react';
import {
  Avatar,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@marketpilot/ui';
import { useAuthStore } from '@/lib/auth-store';
import { signOut } from '@/lib/session';
import { toggleTheme } from '@/lib/theme';

const LINKS = [
  { label: 'Your profile', href: '/settings#profile', icon: UserRound },
  { label: 'Brand profile', href: '/brand', icon: IdCard },
  { label: 'Billing and credits', href: '/settings#billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

const iconProps = { className: 'size-4', strokeWidth: 1.5, 'aria-hidden': true } as const;

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const context = useAuthStore((state) => state.context);
  const name = context?.user.name ?? 'Account';

  async function onSignOut() {
    await signOut();
    queryClient.clear();
    router.replace('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="flex items-center gap-1 rounded-full p-0.5 transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface data-[state=open]:bg-subtle md:pr-2"
      >
        <Avatar name={name} />
        <ChevronDown className="hidden size-4 text-ink-tertiary md:block" strokeWidth={1.5} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-menu">
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-label text-ink">{name}</p>
            <p className="truncate text-caption text-ink-secondary">{context?.user.email}</p>
          </div>
        </DropdownMenuLabel>
        {context ? (
          <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-sm bg-subtle px-3 py-2">
            <span className="truncate text-caption text-ink-secondary">{context.workspace.name}</span>
            <Badge tone="accent" className="capitalize">
              {context.role}
            </Badge>
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {LINKS.map(({ label, href, icon: Icon }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href}>
                <Icon {...iconProps} />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={toggleTheme}>
            <Moon {...iconProps} />
            Switch theme
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => void onSignOut()}>
          <LogOut {...iconProps} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
