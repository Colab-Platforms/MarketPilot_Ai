'use client';

import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@marketpilot/ui';
import { useCopilotStore } from './copilot-store';

// Opens the copilot from every screen. Ctrl+J (Cmd+J on Mac) toggles it.
export function CopilotTrigger() {
  const open = useCopilotStore((s) => s.open);
  const toggle = useCopilotStore((s) => s.toggle);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggle}
      aria-expanded={open}
      aria-controls="copilot-panel"
      aria-keyshortcuts="Control+J Meta+J"
      title="Ask copilot (Ctrl+J)"
    >
      <Sparkles className="size-4 text-accent" strokeWidth={1.5} aria-hidden="true" />
      <span className="hidden md:inline">Ask copilot</span>
      <span className="sr-only md:hidden">Ask copilot</span>
    </Button>
  );
}
