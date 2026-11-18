import { Injectable } from '@nestjs/common';
import { Prisma, type AgentRunStatus, type PendingAction, type ToolCallStatus } from '@prisma/client';
import type { ApprovalBlock } from '@marketpilot/contracts';
import type { Proposal } from '@/common';
import { PrismaService } from '@/infra/prisma';
import type { LlmUsage } from '@/modules/ai';

export interface ToolCallRecord {
  workspaceId: string;
  runId: string;
  step: number;
  name: string;
  args: unknown;
  status: ToolCallStatus;
  resultSummary: string | null;
  error: string | null;
  durationMs: number;
  idempotencyKey: string;
}

export interface NewPendingAction {
  workspaceId: string;
  brandId: string;
  runId: string;
  toolName: string;
  proposal: Proposal;
  idempotencyKey: string;
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

// Run bookkeeping: status, usage, tool calls and proposals. Every write is keyed so a
// replayed graph step finds its earlier row instead of adding another.
@Injectable()
export class RunStore {
  constructor(private readonly prisma: PrismaService) {}

  async recordToolCall(record: ToolCallRecord): Promise<void> {
    await this.prisma.withTenant(record.workspaceId, (tx) =>
      tx.toolCall.createMany({
        data: [{ ...record, args: json(record.args ?? {}), resultSummary: record.resultSummary?.slice(0, 4000) ?? null }],
        skipDuplicates: true,
      }),
    );
  }

  async createPendingAction(input: NewPendingAction): Promise<PendingAction> {
    const { proposal } = input;
    return this.prisma.withTenant(input.workspaceId, (tx) =>
      tx.pendingAction.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        update: {},
        create: {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          runId: input.runId,
          toolName: input.toolName,
          proposal: json(proposal.payload),
          title: proposal.title,
          summary: proposal.summary,
          changes: json(proposal.changes),
          credits: proposal.credits,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    );
  }

  findPendingAction(workspaceId: string, id: string): Promise<PendingAction | null> {
    return this.prisma.withTenant(workspaceId, (tx) => tx.pendingAction.findUnique({ where: { id } }));
  }

  // First decision wins: a second click, or a second approver, changes nothing.
  async decide(
    workspaceId: string,
    id: string,
    decision: { status: 'approved' | 'rejected'; userId: string; note: string | null },
  ): Promise<boolean> {
    const { count } = await this.prisma.withTenant(workspaceId, (tx) =>
      tx.pendingAction.updateMany({
        where: { id, status: 'pending' },
        data: { status: decision.status, decidedByUserId: decision.userId, decidedAt: new Date(), note: decision.note },
      }),
    );
    return count === 1;
  }

  async settleAction(workspaceId: string, id: string, outcome: { ok: boolean; message: string }): Promise<void> {
    await this.prisma.withTenant(workspaceId, (tx) =>
      tx.pendingAction.update({
        where: { id },
        data: { status: outcome.ok ? 'executed' : 'failed', result: json({ message: outcome.message }) },
      }),
    );
  }

  async actionStatuses(workspaceId: string, ids: string[]): Promise<Map<string, ApprovalBlock['status']>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.withTenant(workspaceId, (tx) =>
      tx.pendingAction.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } }),
    );
    return new Map(rows.map((row) => [row.id, row.status]));
  }

  async addUsage(workspaceId: string, runId: string, usage: LlmUsage, steps: number): Promise<void> {
    await this.prisma.withTenant(workspaceId, async (tx) => {
      const run = await tx.agentRun.findUniqueOrThrow({ where: { id: runId }, select: { models: true } });
      await tx.agentRun.update({
        where: { id: runId },
        data: {
          steps,
          promptTokens: { increment: usage.promptTokens },
          completionTokens: { increment: usage.completionTokens },
          costUsd: { increment: usage.costUsd ?? 0 },
          ...(!run.models.includes(usage.model) && { models: { push: usage.model } }),
        },
      });
    });
  }

  totals(workspaceId: string, runId: string) {
    return this.prisma.withTenant(workspaceId, (tx) =>
      tx.agentRun.findUnique({
        where: { id: runId },
        select: { steps: true, promptTokens: true, completionTokens: true, costUsd: true, models: true },
      }),
    );
  }

  async setStatus(workspaceId: string, runId: string, status: AgentRunStatus, error?: string): Promise<void> {
    const finished = status === 'completed' || status === 'failed' || status === 'cancelled';
    await this.prisma.withTenant(workspaceId, (tx) =>
      tx.agentRun.update({
        where: { id: runId },
        data: { status, ...(error && { error: error.slice(0, 500) }), ...(finished && { finishedAt: new Date() }) },
      }),
    );
  }
}
