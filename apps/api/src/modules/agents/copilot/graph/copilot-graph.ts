import { Command, END, START, StateGraph, type BaseCheckpointSaver } from '@langchain/langgraph';
import { guardInput, chooseTools, loadContext } from './context-nodes';
import { agentStep, lastToolCalls, runTools } from './agent-nodes';
import { awaitApproval, refuse, respond } from './reply-nodes';
import type { CopilotDeps } from './deps';
import { CopilotState, type ApprovalResume, type CopilotStateUpdate, type CopilotStateValue } from './state';

// docs/COPILOT_AGENT.md section 3. load_context and guard_input run side by side. Persisting the
// reply, run status and the summary (post_turn) happen in CopilotService after the stream ends,
// from exactly what the owner was shown.
export function buildCopilotGraph(deps: CopilotDeps, checkpointer: BaseCheckpointSaver) {
  return new StateGraph(CopilotState)
    .addNode('load_context', (state) => loadContext(deps, state))
    .addNode('guard_input', (state) => guardInput(deps, state))
    .addNode('select_tools', (state) => chooseTools(deps, state))
    .addNode('refuse', (state, config) => refuse(deps, state, config))
    .addNode('agent', (state, config) => agentStep(deps, state, config))
    .addNode('run_tools', (state, config) => runTools(deps, state, config))
    .addNode('approval', (state) => awaitApproval(deps, state))
    .addNode('respond', (state, config) => respond(deps, state, config))
    .addEdge(START, 'load_context')
    .addEdge(START, 'guard_input')
    .addEdge(['load_context', 'guard_input'], 'select_tools')
    .addConditionalEdges('select_tools', (s: CopilotStateValue) => (s.screen.blocked ? 'refuse' : 'agent'), [
      'refuse',
      'agent',
    ])
    .addEdge('refuse', END)
    .addConditionalEdges(
      'agent',
      (s: CopilotStateValue) => (!s.stopReason && lastToolCalls(s).length > 0 ? 'run_tools' : 'respond'),
      ['run_tools', 'respond'],
    )
    .addConditionalEdges(
      'run_tools',
      (s: CopilotStateValue) => (s.stopReason ? 'respond' : s.proposals.length > 0 ? 'approval' : 'agent'),
      ['respond', 'approval', 'agent'],
    )
    .addConditionalEdges('approval', (s: CopilotStateValue) => (s.proposals.length > 0 ? 'approval' : 'agent'), [
      'approval',
      'agent',
    ])
    .addEdge('respond', END)
    .compile({ checkpointer });
}

export type CopilotGraph = ReturnType<typeof buildCopilotGraph>;

// Input that continues a run paused in the approval node.
export function resumeWith(resume: ApprovalResume) {
  return new Command<ApprovalResume, CopilotStateUpdate, 'approval'>({ resume });
}
