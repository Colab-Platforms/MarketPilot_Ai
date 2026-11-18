import { Injectable, Logger } from '@nestjs/common';
import type { CopilotEvent, PageContext, RunOutcome, UiBlock } from '@marketpilot/contracts';
import { PrismaService } from '@/infra/prisma';
import { AiService, LlmError } from '@/modules/ai';
import { MemoryService } from '@/modules/memory';
import { ConversationStore } from '../conversations/conversation-store';
import { Summariser } from '../conversations/summariser';
import { ExecutionService } from '../runtime/execution.service';
import { PrismaCheckpointer } from '../runtime/prisma-checkpointer';
import { RUN_LIMITS } from '../runtime/run-limits';
import { RunStore } from '../runtime/run-store';
import { ToolRanker } from '../runtime/tool-ranker';
import { ToolRegistry } from '../runtime/tool-registry';
import { ToolRunner } from '../runtime/tool-runner';
import { buildCopilotGraph, resumeWith } from './graph/copilot-graph';
import type { CopilotDeps, CopilotRun } from './graph/deps';
import type { ApprovalInterrupt, ApprovalResume, CopilotStateValue } from './graph/state';

export type EventSink = (event: CopilotEvent) => void;

export type TurnInput =
  | { kind: 'message'; text: string; page: PageContext | null; userMessageId: string }
  | { kind: 'resume'; resume: ApprovalResume };

const RECURSION_LIMIT = 60;

function failureMessage(error: unknown): { code: string; message: string } {
  if (error instanceof LlmError) {
    switch (error.reason) {
      case 'unavailable':
        return { code: 'ai_unavailable', message: 'The copilot is not set up yet.' };
      case 'rate_limited':
        return { code: 'rate_limited', message: 'The copilot is busy. Try again in a minute.' };
      case 'timeout':
        return { code: 'timeout', message: 'That took too long. Try again, or ask about one thing at a time.' };
      default:
        break;
    }
  }
  return { code: 'internal_error', message: 'Something went wrong. Try again.' };
}

// Runs one turn of the copilot graph and streams it to the owner. Afterwards (post_turn) it
// saves exactly what the owner was shown, settles the run's status and refreshes the summary.
@Injectable()
export class RunDriver {
  private readonly logger = new Logger(RunDriver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly memory: MemoryService,
    private readonly conversations: ConversationStore,
    private readonly summariser: Summariser,
    private readonly registry: ToolRegistry,
    private readonly ranker: ToolRanker,
    private readonly runner: ToolRunner,
    private readonly execution: ExecutionService,
    private readonly runs: RunStore,
  ) {}

  async drive(run: Omit<CopilotRun, 'signal'>, input: TurnInput, sink: EventSink, clientSignal: AbortSignal): Promise<void> {
    const signal = AbortSignal.any([clientSignal, AbortSignal.timeout(RUN_LIMITS.wallClockMs)]);
    const deps = this.depsFor({ ...run, signal });
    const graph = buildCopilotGraph(deps, new PrismaCheckpointer(this.prisma, run.workspaceId, run.runId));
    const config = { configurable: { thread_id: run.runId } };

    const started = Date.now();
    let firstTextMs: number | null = null;
    let text = '';
    const blocks: UiBlock[] = [];
    const forward = (event: CopilotEvent) => {
      if (event.type === 'text.delta') {
        firstTextMs ??= Date.now() - started;
        text += event.text;
      }
      if (event.type === 'ui.block') blocks.push(event.block);
      sink(event);
    };

    let outcome: RunOutcome = 'completed';
    let failure: { code: string; message: string } | null = null;
    let pending: ApprovalInterrupt | null = null;
    try {
      const graphInput =
        input.kind === 'resume'
          ? resumeWith(input.resume)
          : { text: input.text, page: input.page, userMessageId: input.userMessageId };
      const stream = await graph.stream(graphInput, { ...config, streamMode: 'custom', signal, recursionLimit: RECURSION_LIMIT });
      for await (const event of stream) forward(event as CopilotEvent);

      const snapshot = await graph.getState(config);
      pending = (snapshot.tasks.flatMap((task) => task.interrupts)[0]?.value as ApprovalInterrupt | undefined) ?? null;
      if (pending) outcome = 'awaiting_approval';
    } catch (error) {
      if (clientSignal.aborted) {
        outcome = 'cancelled';
      } else {
        outcome = 'failed';
        failure = signal.aborted ? failureMessage(new LlmError('timeout', 'wall clock')) : failureMessage(error);
        this.logger.error(`Copilot run ${run.runId} failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    const messageId = await this.saveReply(run, text, pending ? [...blocks, pending.block] : blocks, graph, config);
    await this.runs.setStatus(run.workspaceId, run.runId, outcome === 'awaiting_approval' ? 'awaiting_approval' : outcome, failure?.message);

    if (pending) sink({ type: 'approval.required', block: pending.block });
    if (failure) sink({ type: 'error', ...failure });
    sink({ type: 'done', outcome, messageId });
    await this.logReply(run, input.kind, outcome, Date.now() - started, firstTextMs);
    if (outcome === 'completed') void this.summariser.refresh(run.workspaceId, run.conversationId);
  }

  // One line per copilot reply. Totals cover every model call in the run so far (agent steps,
  // screen, suggestions), so a resumed run's line includes the part before the approval.
  private async logReply(
    run: Omit<CopilotRun, 'signal'>,
    kind: TurnInput['kind'],
    outcome: RunOutcome,
    latencyMs: number,
    firstTextMs: number | null,
  ): Promise<void> {
    const totals = await this.runs.totals(run.workspaceId, run.runId).catch(() => null);
    const usage = totals
      ? ` steps=${totals.steps} tokens=${totals.promptTokens}+${totals.completionTokens} cost=$${totals.costUsd.toFixed(5)} models=${totals.models.join(',') || 'none'}`
      : '';
    this.logger.log(
      `copilot reply run=${run.runId} ${kind} outcome=${outcome} latency=${latencyMs}ms first_text=${firstTextMs ?? '-'}ms${usage}`,
    );
  }

  private async saveReply(
    run: Omit<CopilotRun, 'signal'>,
    text: string,
    blocks: UiBlock[],
    graph: ReturnType<typeof buildCopilotGraph>,
    config: { configurable: { thread_id: string } },
  ): Promise<string | null> {
    const content = text.trim();
    if (!content && blocks.length === 0) return null;
    const usage = await graph
      .getState(config)
      .then((s) => (s.values as CopilotStateValue).usage)
      .catch(() => ({ promptTokens: 0, completionTokens: 0 }));
    const row = await this.conversations.appendAssistant(
      run.workspaceId,
      { id: run.runId, conversationId: run.conversationId },
      { content, blocks, ...usage },
    );
    return row.id;
  }

  private depsFor(run: CopilotRun): CopilotDeps {
    return {
      run,
      ai: this.ai,
      memory: this.memory,
      conversations: this.conversations,
      registry: this.registry,
      ranker: this.ranker,
      runner: this.runner,
      execution: this.execution,
      runs: this.runs,
    };
  }
}
