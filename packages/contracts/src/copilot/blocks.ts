import { z } from 'zod';

// Typed UI the copilot can show beside its text. The model never emits HTML; the server builds
// these from tool results and the web app renders each type with its own component.

export const sourcesBlockSchema = z.object({
  type: z.literal('sources'),
  items: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().nullable(),
        // 'page' for website text, otherwise the kind of record ('product', 'profile:brand', ...).
        kind: z.string(),
      }),
    )
    .max(10),
});

export const approvalChangeSchema = z.object({
  label: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
});

export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'executed', 'failed']);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const approvalBlockSchema = z.object({
  type: z.literal('approval'),
  actionId: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  changes: z.array(approvalChangeSchema),
  credits: z.number().int().nonnegative(),
  status: approvalStatusSchema,
});

export const uiBlockSchema = z.discriminatedUnion('type', [sourcesBlockSchema, approvalBlockSchema]);

export type SourcesBlock = z.infer<typeof sourcesBlockSchema>;
export type ApprovalBlock = z.infer<typeof approvalBlockSchema>;
export type UiBlock = z.infer<typeof uiBlockSchema>;
