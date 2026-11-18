import { Injectable } from '@nestjs/common';
import { Prisma, type AgentRun, type Conversation, type CopilotMessage } from '@prisma/client';
import {
  ErrorCode,
  uiBlockSchema,
  type ConversationSummary,
  type CopilotMessage as CopilotMessageDto,
  type PageContext,
  type UiBlock,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService } from '@/infra/prisma';

const LIST_LIMIT = 30;
const TITLE_CHARS = 80;

export interface Owner {
  workspaceId: string;
  userId: string;
}

export interface History {
  summary: string | null;
  // Oldest first, not yet covered by the summary.
  recent: { role: 'user' | 'assistant'; content: string }[];
}

export function toSummary(row: Conversation): ConversationSummary {
  return { id: row.id, title: row.title, lastActivityAt: row.lastActivityAt.toISOString() };
}

// Blocks are validated on the way in, but a stored block from an older contract version must
// not break the whole conversation, so unknown ones are dropped on the way out.
function readBlocks(value: Prisma.JsonValue): UiBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const parsed = uiBlockSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

export function toMessageDto(row: CopilotMessage): CopilotMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    blocks: readBlocks(row.blocks),
    createdAt: row.createdAt.toISOString(),
  };
}

// Conversations are private to the user who started them; every query filters on the user as
// well as the workspace (RLS covers the workspace).
@Injectable()
export class ConversationStore {
  constructor(private readonly prisma: PrismaService) {}

  create(owner: Owner, brandId: string): Promise<Conversation> {
    return this.prisma.withTenant(owner.workspaceId, (tx) =>
      tx.conversation.create({ data: { workspaceId: owner.workspaceId, userId: owner.userId, brandId } }),
    );
  }

  list(owner: Owner): Promise<Conversation[]> {
    return this.prisma.withTenant(owner.workspaceId, (tx) =>
      tx.conversation.findMany({
        where: { userId: owner.userId },
        orderBy: { lastActivityAt: 'desc' },
        take: LIST_LIMIT,
      }),
    );
  }

  async get(owner: Owner, id: string): Promise<Conversation> {
    const row = await this.prisma.withTenant(owner.workspaceId, (tx) =>
      tx.conversation.findFirst({ where: { id, userId: owner.userId } }),
    );
    if (!row) throw new DomainError(ErrorCode.NotFound, 'That conversation does not exist', 404);
    return row;
  }

  messages(owner: Owner, conversationId: string): Promise<CopilotMessage[]> {
    return this.prisma.withTenant(owner.workspaceId, (tx) =>
      tx.copilotMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } }),
    );
  }

  // The new run and the user's message are written together. A retried send with the same key
  // returns the existing run instead of starting another.
  async startRun(
    owner: Owner,
    conversation: Conversation,
    input: { text: string; page: PageContext | undefined; idempotencyKey: string | undefined },
  ): Promise<{ run: AgentRun; userMessage: CopilotMessage; replay: boolean }> {
    return this.prisma.withTenant(owner.workspaceId, async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.agentRun.findUnique({
          where: { conversationId_idempotencyKey: { conversationId: conversation.id, idempotencyKey: input.idempotencyKey } },
        });
        if (existing) {
          const userMessage = await tx.copilotMessage.findFirstOrThrow({
            where: { runId: existing.id, role: 'user' },
          });
          return { run: existing, userMessage, replay: true };
        }
      }
      const run = await tx.agentRun.create({
        data: {
          workspaceId: owner.workspaceId,
          conversationId: conversation.id,
          userId: owner.userId,
          idempotencyKey: input.idempotencyKey ?? null,
          page: (input.page ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
      const userMessage = await tx.copilotMessage.create({
        data: { workspaceId: owner.workspaceId, conversationId: conversation.id, runId: run.id, role: 'user', content: input.text },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastActivityAt: new Date(),
          ...(!conversation.title && { title: input.text.replace(/\s+/g, ' ').slice(0, TITLE_CHARS) }),
        },
      });
      return { run, userMessage, replay: false };
    });
  }

  findRun(workspaceId: string, runId: string): Promise<AgentRun | null> {
    return this.prisma.withTenant(workspaceId, (tx) => tx.agentRun.findUnique({ where: { id: runId } }));
  }

  async appendAssistant(
    workspaceId: string,
    run: { id: string; conversationId: string },
    message: { content: string; blocks: UiBlock[]; promptTokens: number; completionTokens: number },
  ): Promise<CopilotMessage> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      const row = await tx.copilotMessage.create({
        data: {
          workspaceId,
          conversationId: run.conversationId,
          runId: run.id,
          role: 'assistant',
          content: message.content,
          blocks: message.blocks as Prisma.InputJsonValue,
          promptTokens: message.promptTokens,
          completionTokens: message.completionTokens,
        },
      });
      await tx.conversation.update({ where: { id: run.conversationId }, data: { lastActivityAt: new Date() } });
      return row;
    });
  }

  // The summary plus every message after it, excluding the turn being answered.
  async history(workspaceId: string, conversationId: string, excludeMessageId: string, limit: number): Promise<History> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findUniqueOrThrow({ where: { id: conversationId } });
      const rows = await tx.copilotMessage.findMany({
        where: {
          conversationId,
          id: { not: excludeMessageId, ...(conversation.summaryThroughId && { gt: conversation.summaryThroughId }) },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return {
        summary: conversation.summary,
        recent: rows.reverse().map((row) => ({ role: row.role, content: row.content })),
      };
    });
  }

  // Messages not yet folded into the summary, oldest first.
  unsummarized(workspaceId: string, conversationId: string): Promise<{ conversation: Conversation; messages: CopilotMessage[] }> {
    return this.prisma.withTenant(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findUniqueOrThrow({ where: { id: conversationId } });
      const messages = await tx.copilotMessage.findMany({
        where: { conversationId, ...(conversation.summaryThroughId && { id: { gt: conversation.summaryThroughId } }) },
        orderBy: { createdAt: 'asc' },
      });
      return { conversation, messages };
    });
  }

  async saveSummary(workspaceId: string, conversationId: string, summary: string, throughId: string): Promise<void> {
    await this.prisma.withTenant(workspaceId, (tx) =>
      tx.conversation.update({ where: { id: conversationId }, data: { summary, summaryThroughId: throughId } }),
    );
  }
}
