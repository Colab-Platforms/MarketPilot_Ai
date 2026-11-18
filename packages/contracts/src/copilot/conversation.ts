import { z } from 'zod';
import { uiBlockSchema } from './blocks';

export const MAX_COPILOT_MESSAGE_LENGTH = 4000;

// Where the owner is when they ask, so "make this shorter" knows what "this" is.
export const pageContextSchema = z.object({
  route: z.string().max(200),
  selection: z
    .object({
      kind: z.string().max(40),
      id: z.string().max(80),
      label: z.string().max(200).optional(),
    })
    .optional(),
});
export type PageContext = z.infer<typeof pageContextSchema>;

export const sendCopilotMessageSchema = z.object({
  text: z.string().trim().min(1).max(MAX_COPILOT_MESSAGE_LENGTH),
  page: pageContextSchema.optional(),
});
export type SendCopilotMessageInput = z.infer<typeof sendCopilotMessageSchema>;

export const approvalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  lastActivityAt: z.string(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationListSchema = z.object({ conversations: z.array(conversationSummarySchema) });
export type ConversationList = z.infer<typeof conversationListSchema>;

export const conversationResponseSchema = z.object({ conversation: conversationSummarySchema });
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;

export const copilotMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  blocks: z.array(uiBlockSchema),
  createdAt: z.string(),
});
export type CopilotMessage = z.infer<typeof copilotMessageSchema>;

export const conversationMessagesSchema = z.object({
  conversation: conversationSummarySchema,
  messages: z.array(copilotMessageSchema),
});
export type ConversationMessages = z.infer<typeof conversationMessagesSchema>;
