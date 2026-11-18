import { Injectable, Logger } from '@nestjs/common';
import { DomainError, type ToolContext } from '@/common';
import { RunStore } from './run-store';
import { ToolRegistry } from './tool-registry';

export interface ExecutionOutcome {
  ok: boolean;
  // A sentence for the model and the owner: what changed, or why it did not.
  message: string;
}

// The only place an approved proposal changes anything (CLAUDE.md rule 3). Runs a pending
// action at most once: the stored idempotency key goes to the tool, and a settled action
// returns its earlier outcome instead of running again.
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly registry: ToolRegistry,
    private readonly runs: RunStore,
  ) {}

  async execute(ctx: Omit<ToolContext, 'idempotencyKey'>, actionId: string): Promise<ExecutionOutcome> {
    const action = await this.runs.findPendingAction(ctx.workspaceId, actionId);
    if (!action) return { ok: false, message: 'That change no longer exists.' };
    if (action.status === 'executed' || action.status === 'failed') {
      const stored = (action.result as { message?: string } | null)?.message ?? '';
      return { ok: action.status === 'executed', message: stored };
    }
    if (action.status !== 'approved') return { ok: false, message: 'That change was not approved.' };

    const tool = this.registry.get(action.toolName);
    if (!tool || tool.kind !== 'propose' || !tool.roles.includes(ctx.role)) {
      const outcome = { ok: false, message: 'This change can no longer be made from the copilot.' };
      await this.runs.settleAction(ctx.workspaceId, action.id, outcome);
      return outcome;
    }

    let outcome: ExecutionOutcome;
    try {
      const message = await tool.execute({ ...ctx, idempotencyKey: action.idempotencyKey }, action.proposal);
      outcome = { ok: true, message };
    } catch (error) {
      if (!(error instanceof DomainError)) {
        this.logger.error(`Executing ${tool.name} failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
      outcome = { ok: false, message: error instanceof DomainError ? error.message : 'The change could not be saved.' };
    }
    await this.runs.settleAction(ctx.workspaceId, action.id, outcome);
    return outcome;
  }
}
