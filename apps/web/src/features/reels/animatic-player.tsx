'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, Pause, Play, RotateCcw } from 'lucide-react';
import type { ReelCamera, ReelProject } from '@marketpilot/contracts';
import { Button, Dialog, cn } from '@marketpilot/ui';

// A rough stand-in for each camera move, so the owner can judge pacing before paying for video.
// Written as full class names so Tailwind finds them in this file.
const MOTION: Record<ReelCamera, { from: string; to: string }> = {
  static: { from: 'scale-100', to: 'scale-100' },
  push_in: { from: 'scale-100', to: 'scale-110' },
  pull_out: { from: 'scale-110', to: 'scale-100' },
  pan: { from: 'scale-110 translate-x-4', to: 'scale-110 -translate-x-4' },
  tracking: { from: 'scale-100', to: 'scale-105' },
  handheld: { from: 'scale-105', to: 'scale-105 translate-x-1 translate-y-1' },
};

interface AnimaticPlayerProps {
  reel: ReelProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnimaticPlayer({ reel, open, onOpenChange }: AnimaticPlayerProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [moved, setMoved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const keyframes = new Map(reel.visuals.keyframes.map((k) => [k.subject, k.current?.url ?? null]));
  // An outdated clip no longer matches its scene, so the preview shows the keyframe instead.
  const clips = new Map(
    reel.visuals.clips.map((c) => [c.subject, c.current && !c.outdated ? c.current.url : null]),
  );
  const scene = reel.scenes[index];
  const last = reel.scenes.length - 1;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing, index]);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setPlaying(true);
    }
  }, [open]);

  // Each scene starts at its first framing and eases to its last over the scene's length.
  useEffect(() => {
    setMoved(false);
    const frame = requestAnimationFrame(() => setMoved(true));
    return () => cancelAnimationFrame(frame);
  }, [index]);

  useEffect(() => {
    if (!open || !playing || !scene) return;
    const timer = setTimeout(() => {
      if (index >= last) setPlaying(false);
      else setIndex(index + 1);
    }, scene.durationSeconds * 1000);
    return () => clearTimeout(timer);
  }, [open, playing, index, last, scene]);

  if (!scene) return null;
  const url = keyframes.get(scene.id) ?? null;
  const clipUrl = clips.get(scene.id) ?? null;
  const motion = MOTION[scene.camera];
  const ended = !playing && index === last;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Preview"
      description="Each scene with its timing and text: the clip where one is rendered, otherwise its keyframe."
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative aspect-[9/16] h-preview overflow-hidden rounded-md bg-subtle">
          {clipUrl ? (
            // Cut to the scene's length by the timer, as assembly will cut it.
            <video
              key={scene.id}
              ref={videoRef}
              src={clipUrl}
              aria-label={`Scene ${index + 1}: ${scene.action}`}
              autoPlay={playing}
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : url ? (
            <Image
              key={scene.id}
              src={url}
              alt={`Scene ${index + 1}: ${scene.action}`}
              fill
              unoptimized
              style={{ transitionDuration: `${scene.durationSeconds * 1000}ms` }}
              className={cn(
                'object-cover transition-transform ease-linear motion-reduce:transform-none',
                moved && playing ? motion.to : motion.from,
              )}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <ImageIcon
                className="size-5 text-ink-tertiary"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-caption text-ink-secondary">{scene.action}</span>
            </div>
          )}
          {scene.onScreenText ? (
            // Above the bottom quarter, which Instagram covers with the caption and buttons.
            <div className="absolute inset-x-0 bottom-1/4 flex justify-center px-6">
              <span className="rounded-md bg-ink px-3 py-2 text-center text-heading text-canvas">
                {scene.onScreenText}
              </span>
            </div>
          ) : null}
        </div>

        <ol className="flex w-full gap-1" aria-label="Scenes">
          {reel.scenes.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                aria-label={`Go to scene ${i + 1}`}
                aria-current={i === index ? 'step' : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  'block h-1 w-full rounded-full',
                  i <= index ? 'bg-accent' : 'bg-muted',
                )}
              />
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2">
          <span className="text-caption text-ink-secondary">
            Scene {index + 1} of {reel.scenes.length} · {scene.durationSeconds} s
          </span>
          {ended ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIndex(0);
                setPlaying(true);
              }}
            >
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Play again
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setPlaying(!playing)}>
              {playing ? (
                <Pause className="size-4" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Play className="size-4" strokeWidth={1.5} aria-hidden="true" />
              )}
              {playing ? 'Pause' : 'Play'}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
