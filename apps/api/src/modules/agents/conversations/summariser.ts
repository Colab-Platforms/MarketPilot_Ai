import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiService } from '@/modules/ai';
import { ConversationStore } from './conversation-store';

// The model sees the summary plus the most recent messages. Once more than this many messages
// sit outside the summary, the older ones are folded in, keeping the latest few verbatim.
export const SUMMARY_TRIGGER = 20;
export const KEEP_VERBATIM = 8;
const MESSAGE_CHARS = 1_500;

const summarySchema = z.object({ summary: z.string().min(1).max(4_000) });
const summaryJsonSchema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
};

const SYSTEM = `You keep a running summary of a chat between a small-business owner and their marketing copilot.
Write at most 12 short bullet points: what the owner wants, decisions made, facts they stated about their
business, changes approved or rejected, and open questions. Keep names, numbers and dates exactly.
Do not add anything that was not said. Write in the language the owner uses.`;

@Injectable()
export class Summariser {
  private readonly logger = new Logger(Summariser.name);

  constructor(
    private readonly ai: AiService,
    private readonly conversations: ConversationStore,
  ) {}

  // Never throws: a missing summary only means the model sees fewer old messages.
  async refresh(workspaceId: string, conversationId: string): Promise<void> {
    if (!this.ai.available) return;
    try {
      const { conversation, messages } = await this.conversations.unsummarized(workspaceId, conversationId);
      if (messages.length <= SUMMARY_TRIGGER) return;
      const fold = messages.slice(0, messages.length - KEEP_VERBATIM);
      const through = fold[fold.length - 1];
      if (!through) return;

      const transcript = fold
        .map((m) => `${m.role === 'user' ? 'Owner' : 'Copilot'}: ${m.content.slice(0, MESSAGE_CHARS)}`)
        .join('\n');
      const { data } = await this.ai.structured('copilot.summarize', {
        system: SYSTEM,
        user: `Summary so far:\n${conversation.summary ?? '(none)'}\n\nNew messages:\n${transcript}`,
        schemaName: 'conversation_summary',
        jsonSchema: summaryJsonSchema,
        schema: summarySchema,
        maxOutputTokens: 1_200,
      });
      await this.conversations.saveSummary(workspaceId, conversationId, data.summary, through.id);
    } catch (error) {
      this.logger.warn(`Summary refresh failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
