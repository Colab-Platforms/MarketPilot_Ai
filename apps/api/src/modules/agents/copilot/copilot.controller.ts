import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  approvalDecisionSchema,
  ErrorCode,
  sendCopilotMessageSchema,
  type ApprovalDecisionInput,
  type ConversationList,
  type ConversationMessages,
  type ConversationResponse,
  type SendCopilotMessageInput,
} from '@marketpilot/contracts';
import { DomainError, ZodValidationPipe } from '@/common';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { CopilotService, type PreparedTurn } from './copilot.service';
import { openSse } from './sse';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post('conversations')
  async create(@CurrentAuth() principal: AuthPrincipal): Promise<ConversationResponse> {
    return { conversation: await this.copilot.create(principal) };
  }

  @Get('conversations')
  async list(@CurrentAuth() principal: AuthPrincipal): Promise<ConversationList> {
    return { conversations: await this.copilot.list(principal) };
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConversationMessages> {
    return this.copilot.messages(principal, id);
  }

  // Streams the reply as server-sent events (contracts: copilotEventSchema).
  @Post('conversations/:id/messages')
  @HttpCode(200)
  async send(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(sendCopilotMessageSchema)) body: SendCopilotMessageInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new DomainError(ErrorCode.Validation, 'Idempotency-Key must be 8 to 100 letters, digits, - or _', 400);
    }
    const turn = await this.copilot.prepareMessage(principal, id, body, idempotencyKey);
    await this.stream(turn, response);
  }

  // Approve or reject a proposed change; the paused run resumes and streams the rest of its reply.
  @Post('actions/:id/decision')
  @HttpCode(200)
  async decide(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(approvalDecisionSchema)) body: ApprovalDecisionInput,
    @Res() response: Response,
  ): Promise<void> {
    const turn = await this.copilot.prepareDecision(principal, id, body);
    await this.stream(turn, response);
  }

  private async stream(turn: PreparedTurn, response: Response): Promise<void> {
    const channel = openSse(response);
    channel.send({ type: 'run.started', conversationId: turn.conversationId, runId: turn.runId });
    try {
      await turn.start((event) => channel.send(event), channel.signal);
    } finally {
      channel.close();
    }
  }
}
