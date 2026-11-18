import { z } from 'zod';
import { approvalBlockSchema, uiBlockSchema } from './blocks';

export const runOutcomeSchema = z.enum(['completed', 'awaiting_approval', 'failed', 'cancelled']);
export type RunOutcome = z.infer<typeof runOutcomeSchema>;

// Server-sent events on the copilot message stream, one JSON object per `data:` line.
export const copilotEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run.started'), conversationId: z.string().uuid(), runId: z.string().uuid() }),
  z.object({ type: z.literal('text.delta'), text: z.string() }),
  z.object({ type: z.literal('tool.started'), callId: z.string(), name: z.string(), label: z.string() }),
  z.object({ type: z.literal('tool.finished'), callId: z.string(), name: z.string(), ok: z.boolean() }),
  z.object({ type: z.literal('ui.block'), block: uiBlockSchema }),
  z.object({ type: z.literal('approval.required'), block: approvalBlockSchema }),
  z.object({ type: z.literal('suggestions'), items: z.array(z.string()).max(3) }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ type: z.literal('done'), outcome: runOutcomeSchema, messageId: z.string().uuid().nullable() }),
]);

export type CopilotEvent = z.infer<typeof copilotEventSchema>;
