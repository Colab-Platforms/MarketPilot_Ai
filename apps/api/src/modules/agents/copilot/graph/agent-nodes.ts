import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ChatMessage } from '@/modules/ai';
import { RUN_LIMITS } from '../../runtime/run-limits';
import { fromModelToolName } from '../../runtime/tool-names';
import type { ToolOutcome } from '../../runtime/tool-runner';
import { LAST_STEP_NOTE } from '../prompts';
import { emit, type CopilotDeps } from './deps';
import type { CopilotStateUpdate, CopilotStateValue, OpenProposal } from './state';

// One model step: reason over the transcript, then answer or call tools. Answer text streams to
// the owner as it arrives; tool-call arguments never do.
export async function agentStep(
  deps: CopilotDeps,
  state: CopilotStateValue,
  config: LangGraphRunnableConfig,
): Promise<CopilotStateUpdate> {
  const used = state.usage.promptTokens + state.usage.completionTokens;
  if (used >= RUN_LIMITS.maxTokens) return { stopReason: 'tokens' };

  const step = state.steps + 1;
  const lastStep = step >= RUN_LIMITS.maxSteps;
  const system = lastStep ? `${state.system}\n\n${LAST_STEP_NOTE}` : state.system;
  const result = await deps.ai.converse('copilot.turn', {
    messages: [{ role: 'system', content: system }, ...state.messages],
    tools: lastStep ? [] : deps.registry.specsFor(state.tools),
    onText: (text) => emit(config, { type: 'text.delta', text }),
    signal: deps.run.signal,
  });
  await deps.runs.addUsage(deps.run.workspaceId, deps.run.runId, result.usage, step);

  const message: ChatMessage = {
    role: 'assistant',
    content: result.content,
    ...(result.toolCalls.length > 0 && { toolCalls: result.toolCalls }),
  };
  return {
    messages: [message],
    steps: step,
    usage: {
      promptTokens: state.usage.promptTokens + result.usage.promptTokens,
      completionTokens: state.usage.completionTokens + result.usage.completionTokens,
    },
  };
}

export function lastToolCalls(state: CopilotStateValue) {
  const last = state.messages[state.messages.length - 1];
  return last?.role === 'assistant' ? (last.toolCalls ?? []) : [];
}

// Runs every tool call from the last step together. Results go back to the model; proposals wait
// for the approval node, which adds their tool messages once the owner decides.
export async function runTools(
  deps: CopilotDeps,
  state: CopilotStateValue,
  config: LangGraphRunnableConfig,
): Promise<CopilotStateUpdate> {
  const calls = lastToolCalls(state);
  const outcomes = await Promise.all(
    calls.map(async (call): Promise<ToolOutcome> => {
      const tool = deps.registry.get(fromModelToolName(call.name));
      emit(config, { type: 'tool.started', callId: call.id, name: tool?.name ?? call.name, label: tool?.label ?? 'Working' });
      const outcome = await deps.runner.run(deps.run, state.steps, call, state.tools);
      emit(config, { type: 'tool.finished', callId: call.id, name: outcome.name, ok: outcome.kind === 'proposal' || outcome.ok });
      return outcome;
    }),
  );

  const messages: ChatMessage[] = [];
  const proposals: OpenProposal[] = [];
  const found = new Set<string>();
  let invalid = state.invalidArgs;
  for (const outcome of outcomes) {
    if (outcome.kind === 'proposal') {
      proposals.push({ callId: outcome.callId, actionId: outcome.actionId, block: outcome.block });
      continue;
    }
    messages.push({ role: 'tool', toolCallId: outcome.callId, content: outcome.content });
    if (outcome.block) emit(config, { type: 'ui.block', block: outcome.block });
    if (outcome.invalidArgs) invalid += 1;
    outcome.foundTools.forEach((name) => found.add(name));
  }

  return {
    messages,
    proposals,
    invalidArgs: invalid,
    tools: [...new Set([...state.tools, ...found])],
    ...(invalid > RUN_LIMITS.maxInvalidArgs && { stopReason: 'invalid_args' }),
  };
}
