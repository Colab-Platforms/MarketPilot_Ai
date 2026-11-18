import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type ApprovalDecisionInput,
  type ConversationMessages,
  type ConversationSummary,
  type SendCopilotMessageInput,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService } from '@/infra/prisma';
import { BrandProfileService, BrandService } from '@/modules/brand';
import type { AuthPrincipal } from '@/modules/identity';
import { ConversationStore, toMessageDto, toSummary, type Owner } from '../conversations/conversation-store';
import { RunStore } from '../runtime/run-store';
import { ToolRegistry } from '../runtime/tool-registry';
import type { CopilotRun } from './graph/deps';
import { RunDriver, type EventSink, type TurnInput } from './run-driver';

// A turn that passed every check and can start streaming. Checks run before the SSE response
// opens, so failures still reach the client as an ordinary error envelope.
export interface PreparedTurn {
  conversationId: string;
  runId: string;
  // A retried send whose run already exists: nothing new runs.
  replay: boolean;
  start(sink: EventSink, signal: AbortSignal): Promise<void>;
}

async function replayed(sink: EventSink): Promise<void> {
  sink({ type: 'error', code: 'conflict', message: 'This message was already sent. Reload the conversation to see the reply.' });
  sink({ type: 'done', outcome: 'completed', messageId: null });
}

const owner = (principal: AuthPrincipal): Owner => ({ workspaceId: principal.workspaceId, userId: principal.userId });

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandService,
    private readonly profiles: BrandProfileService,
    private readonly conversations: ConversationStore,
    private readonly runs: RunStore,
    private readonly registry: ToolRegistry,
    private readonly driver: RunDriver,
  ) {}

  async create(principal: AuthPrincipal): Promise<ConversationSummary> {
    const brandId = await this.prisma.withTenant(principal.workspaceId, (tx) =>
      this.profiles.brandIdOf(tx, principal.workspaceId),
    );
    return toSummary(await this.conversations.create(owner(principal), brandId));
  }

  async list(principal: AuthPrincipal): Promise<ConversationSummary[]> {
    return (await this.conversations.list(owner(principal))).map(toSummary);
  }

  // Approval cards are stored as shown; their live status is read from the action itself.
  async messages(principal: AuthPrincipal, conversationId: string): Promise<ConversationMessages> {
    const conversation = await this.conversations.get(owner(principal), conversationId);
    const messages = (await this.conversations.messages(owner(principal), conversationId)).map(toMessageDto);
    const actionIds = messages.flatMap((m) => m.blocks.flatMap((b) => (b.type === 'approval' ? [b.actionId] : [])));
    const statuses = await this.runs.actionStatuses(principal.workspaceId, actionIds);
    return {
      conversation: toSummary(conversation),
      messages: messages.map((m) => ({
        ...m,
        blocks: m.blocks.map((b) => (b.type === 'approval' ? { ...b, status: statuses.get(b.actionId) ?? b.status } : b)),
      })),
    };
  }

  async prepareMessage(
    principal: AuthPrincipal,
    conversationId: string,
    input: SendCopilotMessageInput,
    idempotencyKey: string | undefined,
  ): Promise<PreparedTurn> {
    const conversation = await this.conversations.get(owner(principal), conversationId);
    const { run, userMessage, replay } = await this.conversations.startRun(owner(principal), conversation, {
      text: input.text,
      page: input.page,
      idempotencyKey,
    });
    const turn: TurnInput = { kind: 'message', text: input.text, page: input.page ?? null, userMessageId: userMessage.id };
    return this.prepared(principal, conversation.id, conversation.brandId, run.id, replay, turn);
  }

  async prepareDecision(principal: AuthPrincipal, actionId: string, input: ApprovalDecisionInput): Promise<PreparedTurn> {
    const action = await this.runs.findPendingAction(principal.workspaceId, actionId);
    const run = action ? await this.conversations.findRun(principal.workspaceId, action.runId) : null;
    // Conversations are private, so another member's proposal looks the same as a missing one.
    if (!action || !run || run.userId !== principal.userId) {
      throw new DomainError(ErrorCode.NotFound, 'That change does not exist', 404);
    }
    const tool = this.registry.get(action.toolName);
    if (input.decision === 'approve' && (!tool || !tool.roles.includes(principal.role))) {
      throw new DomainError(ErrorCode.Forbidden, 'Your role cannot approve this change', 403);
    }
    if (run.status !== 'awaiting_approval') {
      throw new DomainError(ErrorCode.Conflict, 'This change was already decided', 409);
    }
    const decided = await this.runs.decide(principal.workspaceId, action.id, {
      status: input.decision === 'approve' ? 'approved' : 'rejected',
      userId: principal.userId,
      note: input.note ?? null,
    });
    if (!decided) throw new DomainError(ErrorCode.Conflict, 'This change was already decided', 409);
    await this.runs.setStatus(principal.workspaceId, run.id, 'running');

    const turn: TurnInput = { kind: 'resume', resume: { decision: input.decision, note: input.note } };
    return this.prepared(principal, run.conversationId, action.brandId, run.id, false, turn);
  }

  private async prepared(
    principal: AuthPrincipal,
    conversationId: string,
    brandId: string,
    runId: string,
    replay: boolean,
    turn: TurnInput,
  ): Promise<PreparedTurn> {
    const brand = await this.prisma.withTenant(principal.workspaceId, (tx) => this.brands.snapshot(tx, brandId));
    const run: Omit<CopilotRun, 'signal'> = {
      workspaceId: principal.workspaceId,
      brandId,
      userId: principal.userId,
      role: principal.role,
      runId,
      conversationId,
      brandName: brand.name,
    };
    return {
      conversationId,
      runId,
      replay,
      start: (sink, signal) => (replay ? replayed(sink) : this.driver.drive(run, turn, sink, signal)),
    };
  }
}
