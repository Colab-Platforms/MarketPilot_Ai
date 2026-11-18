import { interrupt, type LangGraphRunnableConfig } from '@langchain/langgraph';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { BLOCKED_REPLY, LIMIT_REPLIES, SUGGEST_SYSTEM } from '../prompts';
import { emit, type CopilotDeps } from './deps';
import type { ApprovalInterrupt, ApprovalResume, CopilotStateUpdate, CopilotStateValue } from './state';

const logger = new Logger('CopilotReply');

const suggestSchema = z.object({ suggestions: z.array(z.string().trim().min(1).max(80)).max(3) });
const suggestJsonSchema = {
  type: 'object',
  properties: { suggestions: { type: 'array', items: { type: 'string' } } },
  required: ['suggestions'],
  additionalProperties: false,
};

// Pauses the run on the first open proposal until the owner decides. LangGraph re-runs this node
// from the top on resume, so nothing before `interrupt` may have side effects. Execution after it
// is safe to repeat: ExecutionService returns a settled action's earlier outcome.
export async function awaitApproval(deps: CopilotDeps, state: CopilotStateValue): Promise<CopilotStateUpdate> {
  const [open, ...rest] = state.proposals;
  if (!open) return {};
  const payload: ApprovalInterrupt = { actionId: open.actionId, block: open.block };
  const answer = interrupt<ApprovalInterrupt, ApprovalResume>(payload);

  let content: string;
  if (answer.decision === 'approve') {
    const outcome = await deps.execution.execute(deps.run, open.actionId);
    content = outcome.ok ? `Done. ${outcome.message}` : `The change failed: ${outcome.message}`;
  } else {
    const note = answer.note ? ` They said: "${answer.note}"` : '';
    content = `The owner rejected this change.${note} Do not propose it again unless they ask.`;
  }
  return { messages: [{ role: 'tool', toolCallId: open.callId, content }], proposals: rest };
}

export function refuse(_deps: CopilotDeps, _state: CopilotStateValue, config: LangGraphRunnableConfig): CopilotStateUpdate {
  emit(config, { type: 'text.delta', text: BLOCKED_REPLY });
  return {};
}

// Closes the turn: explains a limit if one was hit, then offers follow-up questions.
export async function respond(
  deps: CopilotDeps,
  state: CopilotStateValue,
  config: LangGraphRunnableConfig,
): Promise<CopilotStateUpdate> {
  if (state.stopReason) emit(config, { type: 'text.delta', text: `\n\n${LIMIT_REPLIES[state.stopReason] ?? ''}` });
  if (!deps.ai.available) return {};

  const answer = state.messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content)
    .join('\n')
    .slice(-2_000);
  try {
    const { data, usage } = await deps.ai.structured('copilot.suggest', {
      system: SUGGEST_SYSTEM,
      user: `Owner: ${state.text}\n\nCopilot: ${answer}`,
      schemaName: 'copilot_suggestions',
      jsonSchema: suggestJsonSchema,
      schema: suggestSchema,
      maxOutputTokens: 200,
      timeoutMs: 8_000,
    });
    await deps.runs.addUsage(deps.run.workspaceId, deps.run.runId, usage, state.steps);
    if (data.suggestions.length > 0) emit(config, { type: 'suggestions', items: data.suggestions.slice(0, 3) });
  } catch (error) {
    logger.warn(`Suggestions skipped: ${error instanceof Error ? error.message : 'unknown'}`);
  }
  return {};
}
