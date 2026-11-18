import {
  BarChart3,
  CalendarDays,
  FolderOpen,
  House,
  IdCard,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  // A shorter label for the narrow mobile bar.
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home', href: '/home', icon: House },
      { label: 'Create', href: '/create', icon: Sparkles },
      { label: 'Calendar', href: '/calendar', icon: CalendarDays },
      { label: 'Library', href: '/library', icon: FolderOpen },
    ],
  },
  {
    label: 'Grow',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'Brand profile', shortLabel: 'Brand', href: '/brand', icon: IdCard },
    ],
  },
];

export const primaryNav: NavItem[] = navGroups.flatMap((group) => group.items);

export const secondaryNav: NavItem[] = [{ label: 'Settings', href: '/settings', icon: Settings }];

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
