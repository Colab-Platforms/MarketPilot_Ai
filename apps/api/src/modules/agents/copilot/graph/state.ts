import { Annotation } from '@langchain/langgraph';
import type { PageContext, UiBlock } from '@marketpilot/contracts';
import type { ToolDomain } from '@/common';
import type { ChatMessage } from '@/modules/ai';

export interface Screen {
  blocked: boolean;
  domains: ToolDomain[];
}

export interface OpenProposal {
  callId: string;
  actionId: string;
  block: Extract<UiBlock, { type: 'approval' }>;
}

export interface ApprovalInterrupt {
  actionId: string;
  block: Extract<UiBlock, { type: 'approval' }>;
}

export interface ApprovalResume {
  decision: 'approve' | 'reject';
  note?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

const last = <T>(init: () => T) => Annotation<T>({ reducer: (_current, next) => next, default: init });

// Checkpointed after every step, so a run can pause for approval and resume hours later.
// Only what the next step needs lives here; the conversation itself is in our own tables.
export const CopilotState = Annotation.Root({
  text: last<string>(() => ''),
  // The stored owner message for this turn, left out of the history read back from the database.
  userMessageId: last<string>(() => ''),
  page: last<PageContext | null>(() => null),
  system: last<string>(() => ''),
  // This turn's transcript for the model: history, the owner's message, then assistant and tool turns.
  messages: Annotation<ChatMessage[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
  screen: last<Screen>(() => ({ blocked: false, domains: [] })),
  tools: last<string[]>(() => []),
  steps: last<number>(() => 0),
  invalidArgs: last<number>(() => 0),
  usage: last<Usage>(() => ({ promptTokens: 0, completionTokens: 0 })),
  proposals: last<OpenProposal[]>(() => []),
  // Set when a limit ends the run; the reply then says so.
  stopReason: last<string | null>(() => null),
});

export type CopilotStateValue = typeof CopilotState.State;
export type CopilotStateUpdate = typeof CopilotState.Update;
