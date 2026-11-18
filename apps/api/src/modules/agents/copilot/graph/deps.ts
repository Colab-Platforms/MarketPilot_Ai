import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { CopilotEvent } from '@marketpilot/contracts';
import type { AiService } from '@/modules/ai';
import type { MemoryService } from '@/modules/memory';
import type { ConversationStore } from '../../conversations/conversation-store';
import type { ExecutionService } from '../../runtime/execution.service';
import type { RunStore } from '../../runtime/run-store';
import type { RunContext, ToolRunner } from '../../runtime/tool-runner';
import type { ToolRanker } from '../../runtime/tool-ranker';
import type { ToolRegistry } from '../../runtime/tool-registry';

export interface CopilotRun extends RunContext {
  conversationId: string;
  brandName: string;
}

// Everything a node may use. Built per request from the authenticated session, so the tenant,
// user and role can never come from model output.
export interface CopilotDeps {
  run: CopilotRun;
  ai: AiService;
  memory: MemoryService;
  conversations: ConversationStore;
  registry: ToolRegistry;
  ranker: ToolRanker;
  runner: ToolRunner;
  execution: ExecutionService;
  runs: RunStore;
}

export function emit(config: LangGraphRunnableConfig, event: CopilotEvent): void {
  config.writer?.(event);
}
