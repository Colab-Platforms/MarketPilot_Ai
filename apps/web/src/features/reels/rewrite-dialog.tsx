'use client';

import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import {
  REWRITE_INSTRUCTION_MAX_CHARS,
  REWRITE_INSTRUCTION_MIN_CHARS,
} from '@marketpilot/contracts';
import { Alert, Button, Dialog, Field, Textarea } from '@marketpilot/ui';

const SUGGESTIONS = [
  'Make it more fun',
  'Show the product closer',
  'Make the hook stronger',
  'Simpler action',
];

interface RewriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneNumber: number;
  rewriting: boolean;
  error: string | null;
  onSubmit: (instruction: string) => void;
}

export function RewriteDialog({
  open,
  onOpenChange,
  sceneNumber,
  rewriting,
  error,
  onSubmit,
}: RewriteDialogProps) {
  const [instruction, setInstruction] = useState('');
  const tooShort = instruction.trim().length < REWRITE_INSTRUCTION_MIN_CHARS;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!tooShort) onSubmit(instruction.trim());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Rewrite scene ${sceneNumber}`}
      description="Say what to change. Only this scene is rewritten; the rest stays as it is."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="What should change?">
          <Textarea
            value={instruction}
            maxLength={REWRITE_INSTRUCTION_MAX_CHARS}
            rows={3}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="secondary" size="sm" onClick={() => setInstruction(s)}>
              {s}
            </Button>
          ))}
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" loading={rewriting} disabled={tooShort} className="self-start">
          <Sparkles className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Rewrite scene
        </Button>
      </form>
    </Dialog>
  );
}
