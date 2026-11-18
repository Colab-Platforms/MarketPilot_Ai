'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { toggleTheme } from '@/lib/theme';

export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      onClick={toggleTheme}
    >
      <Sun
        className="hidden size-4 [html[data-theme=dark]_&]:block"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <Moon
        className="size-4 [html[data-theme=dark]_&]:hidden"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </Button>
  );
}
