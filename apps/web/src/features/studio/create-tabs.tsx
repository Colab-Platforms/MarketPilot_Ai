'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TabNav } from '@marketpilot/ui';

export function CreateTabs() {
  const pathname = usePathname();
  const inReels = pathname.startsWith('/create/reels');
  return (
    <TabNav
      label="What to create"
      linkComponent={Link}
      items={[
        { label: 'Images', href: '/create', current: !inReels },
        { label: 'Reels', href: '/create/reels', current: inReels },
      ]}
    />
  );
}
