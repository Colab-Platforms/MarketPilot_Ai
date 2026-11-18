import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ApprovalBlock, UiBlock } from '@marketpilot/contracts';
import { DomainError, type AnyProposeTool, type AnyReadTool, type ToolContext } from '@/common';
import type { ToolCallRequest } from '@/modules/ai';
import { ExecutionGate } from './execution-gate';
import { ExecutionService } from './execution.service';
import { RunStore } from './run-store';
import { fromModelToolName } from './tool-names';
import { ToolRegistry } from './tool-registry';

export type RunContext = Omit<ToolContext, 'idempotencyKey'>;

export type ToolOutcome =
  | {
      kind: 'result';
      callId: string;
      name: string;
      ok: boolean;
      // Goes back to the model as the tool message.
      content: string;
      block: UiBlock | null;
      // Tools found by tools.search, bound on the next step.
      foundTools: string[];
      invalidArgs: boolean;
    }
  | { kind: 'proposal'; callId: string; name: string; actionId: string; block: ApprovalBlock };

class ToolRefusal extends Error {
  constructor(
    message: string,
    readonly status: 'error' | 'denied',
    readonly invalidArgs = false,
  ) {
    super(message);
  }
}

export function idempotencyKeyFor(runId: string, step: number, name: string, args: unknown): string {
  return createHash('sha256').update(JSON.stringify([runId, step, name, args])).digest('hex');
}

// Runs one model tool call: checks it was offered, validates arguments with the tool's schema,
// checks the role, runs it and records it. Proposals are stored and gated, never executed here.
@Injectable()
export class ToolRunner {
  private readonly logger = new Logger(ToolRunner.name);

  constructor(
    private readonly registry: ToolRegistry,
    private readonly gate: ExecutionGate,
    private readonly execution: ExecutionService,
    private readonly runs: RunStore,
  ) {}

  async run(run: RunContext, step: number, call: ToolCallRequest, offered: readonly string[]): Promise<ToolOutcome> {
    const name = fromModelToolName(call.name);
    const started = Date.now();
    let args: unknown = null;
    let key = idempotencyKeyFor(run.runId, step, name, call.arguments);
    try {
      const tool = this.registry.get(name);
      if (!tool || !offered.includes(name)) throw new ToolRefusal(`${name} is not available. Use only the tools you were given.`, 'denied');
      if (!tool.roles.includes(run.role)) throw new ToolRefusal(`The owner's role cannot use ${name}.`, 'denied');
      args = this.parseArgs(tool, call.arguments);
      key = idempotencyKeyFor(run.runId, step, name, args);
      const ctx: ToolContext = { ...run, idempotencyKey: key };

      const outcome =
        tool.kind === 'propose'
          ? await this.propose(ctx, tool, call.id, args)
          : await this.read(ctx, tool, call.id, args);
      await this.record(run, step, name, args, key, started, {
        status: 'ok',
        summary: outcome.kind === 'result' ? outcome.content : `proposal ${outcome.actionId}`,
      });
      return outcome;
    } catch (error) {
      const refusal = this.toRefusal(error, name);
      await this.record(run, step, name, args ?? call.arguments, key, started, {
        status: refusal.status,
        error: refusal.message,
      });
      return {
        kind: 'result',
        callId: call.id,
        name,
        ok: false,
        content: `Error: ${refusal.message}`,
        block: null,
        foundTools: [],
        invalidArgs: refusal.invalidArgs,
      };
    }
  }

  private async read(ctx: ToolContext, tool: AnyReadTool, callId: string, args: unknown): Promise<ToolOutcome> {
    const result: unknown = await tool.run(ctx, args);
    const foundTools =
      tool.name === 'tools.search' && Array.isArray(result) ? result.map((m: { name: string }) => m.name) : [];
    return {
      kind: 'result',
      callId,
      name: tool.name,
      ok: true,
      content: tool.summarize(result),
      block: tool.render?.(result) ?? null,
      foundTools,
      invalidArgs: false,
    };
  }

  // A proposal has no side effects; only ExecutionService changes anything, and only once allowed.
  private async propose(ctx: ToolContext, tool: AnyProposeTool, callId: string, args: unknown): Promise<ToolOutcome> {
    const proposal = await tool.propose(ctx, args);
    const verdict = this.gate.evaluate(ctx, tool, proposal);
    if (verdict === 'deny') throw new ToolRefusal(`The owner's role cannot make this change.`, 'denied');

    const action = await this.runs.createPendingAction({
      workspaceId: ctx.workspaceId,
      brandId: ctx.brandId,
      runId: ctx.runId,
      toolName: tool.name,
      proposal,
      idempotencyKey: ctx.idempotencyKey,
    });
    const block: ApprovalBlock = {
      type: 'approval',
      actionId: action.id,
      title: proposal.title,
      summary: proposal.summary,
      changes: proposal.changes,
      credits: proposal.credits,
      status: 'pending',
    };
    if (verdict === 'auto') {
      const done = await this.execution.execute(ctx, action.id);
      return {
        kind: 'result',
        callId,
        name: tool.name,
        ok: done.ok,
        content: done.message,
        block: { ...block, status: done.ok ? 'executed' : 'failed' },
        foundTools: [],
        invalidArgs: false,
      };
    }
    return { kind: 'proposal', callId, name: tool.name, actionId: action.id, block };
  }

  private parseArgs(tool: AnyReadTool | AnyProposeTool, raw: string): unknown {
    let value: unknown;
    try {
      value = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      throw new ToolRefusal('Arguments were not valid JSON.', 'error', true);
    }
    const parsed = tool.args.safeParse(value);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ');
      throw new ToolRefusal(`Invalid arguments for ${tool.name}: ${issues}`, 'error', true);
    }
    return parsed.data;
  }

  private toRefusal(error: unknown, name: string): ToolRefusal {
    if (error instanceof ToolRefusal) return error;
    if (error instanceof DomainError) return new ToolRefusal(error.message, 'error');
    this.logger.error(`Tool ${name} failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return new ToolRefusal(`${name} failed. Tell the owner it did not work and suggest trying again.`, 'error');
  }

  private async record(
    run: RunContext,
    step: number,
    name: string,
    args: unknown,
    key: string,
    started: number,
    outcome: { status: 'ok' | 'error' | 'denied'; summary?: string; error?: string },
  ): Promise<void> {
    await this.runs.recordToolCall({
      workspaceId: run.workspaceId,
      runId: run.runId,
      step,
      name,
      args,
      status: outcome.status,
      resultSummary: outcome.summary ?? null,
      error: outcome.error ?? null,
      durationMs: Date.now() - started,
      idempotencyKey: key,
    });
  }
}
