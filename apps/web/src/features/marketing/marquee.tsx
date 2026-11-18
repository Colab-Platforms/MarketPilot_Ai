'use client';

import { useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button, cn } from '@marketpilot/ui';
import { Container } from './section';

export function Marquee({ rows }: { rows: ReactNode[] }) {
  const [paused, setPaused] = useState(false);
  const playState = { animationPlayState: paused ? 'paused' : 'running' } as const;

  return (
    <div>
      <Container className="flex items-center justify-between gap-4">
        <p className="text-label text-ink-secondary">A sample of what goes out every week</p>
        <Button variant="ghost" size="sm" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? (
            <Play className="size-4" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Pause className="size-4" strokeWidth={1.5} aria-hidden="true" />
          )}
          {paused ? 'Play motion' : 'Pause motion'}
        </Button>
      </Container>
      <div className="mt-3 grid gap-3 overflow-hidden">
        {rows.map((row, index) => (
          <div key={index} className="overflow-hidden">
            <div
              style={playState}
              className={cn(
                'flex w-max motion-reduce:animate-none',
                index % 2 === 0 ? 'animate-marquee' : 'animate-marquee-reverse',
              )}
            >
              <div className="flex gap-3 pr-3">{row}</div>
              <div aria-hidden="true" className="flex gap-3 pr-3">
                {row}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
