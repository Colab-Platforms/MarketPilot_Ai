import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type { ToolDomain } from '@/common';
import type { ChatMessage } from '@/modules/ai';
import { RUN_LIMITS } from '../../runtime/run-limits';
import { needsRanking, selectTools } from '../../runtime/tool-selector';
import { SCREEN_SYSTEM, buildSystemPrompt, buildUserTurn } from '../prompts';
import type { CopilotDeps } from './deps';
import type { CopilotStateUpdate, CopilotStateValue, Screen } from './state';

const logger = new Logger('CopilotContext');

const HISTORY_MESSAGES = 12;
const BUSINESS_BUDGET_TOKENS = 1_800;

const DOMAINS = ['brain', 'profile', 'content', 'calendar', 'publishing', 'analytics', 'billing'] as const;

const screenSchema = z.object({
  verdict: z.enum(['allow', 'block']),
  domains: z.array(z.enum(DOMAINS)).max(DOMAINS.length),
});
const screenJsonSchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['allow', 'block'] },
    domains: { type: 'array', items: { type: 'string', enum: [...DOMAINS] } },
  },
  required: ['verdict', 'domains'],
  additionalProperties: false,
};

// Session, conversation and Business Brain context. Only the L1 core comes in here; deeper
// memory arrives through brain.search when the question needs it.
export async function loadContext(deps: CopilotDeps, state: CopilotStateValue): Promise<CopilotStateUpdate> {
  const { run, memory, conversations } = deps;
  const [history, business] = await Promise.all([
    conversations.history(run.workspaceId, run.conversationId, state.userMessageId, HISTORY_MESSAGES),
    memory
      .buildContext(run.workspaceId, run.brandId, { objective: state.text, budgetTokens: BUSINESS_BUDGET_TOKENS })
      .then((context) => context.text)
      .catch((error: unknown) => {
        logger.warn(`Business context failed: ${error instanceof Error ? error.message : 'unknown'}`);
        return '';
      }),
  ]);
  const messages: ChatMessage[] = [
    ...history.recent.map((m): ChatMessage => ({ role: m.role, content: m.content })),
    { role: 'user', content: buildUserTurn(state.text, state.page, new Date()) },
  ];
  return {
    system: buildSystemPrompt({ brandName: run.brandName, business, summary: history.summary }),
    messages,
  };
}

// Policy screen on what the owner typed, plus the domains it touches for tool selection. Runs
// beside load_context. It fails open: tools are already limited by role and tenant, so a screen
// outage should not take the copilot down.
export async function guardInput(deps: CopilotDeps, state: CopilotStateValue): Promise<CopilotStateUpdate> {
  if (!deps.ai.available) return { screen: { blocked: false, domains: [] } };
  try {
    const { data, usage } = await deps.ai.structured('copilot.screen', {
      system: SCREEN_SYSTEM,
      user: state.text,
      schemaName: 'copilot_screen',
      jsonSchema: screenJsonSchema,
      schema: screenSchema,
      maxOutputTokens: 200,
      timeoutMs: 8_000,
    });
    await deps.runs.addUsage(deps.run.workspaceId, deps.run.runId, usage, 0);
    return { screen: { blocked: data.verdict === 'block', domains: data.domains as ToolDomain[] } };
  } catch (error) {
    logger.warn(`Input screen failed open: ${error instanceof Error ? error.message : 'unknown'}`);
    return { screen: { blocked: false, domains: [] } };
  }
}

export async function chooseTools(deps: CopilotDeps, state: CopilotStateValue): Promise<CopilotStateUpdate> {
  if (state.screen.blocked) return { tools: [] };
  const allowed = deps.registry.forRole(deps.run.role);
  const ranked = needsRanking(allowed, RUN_LIMITS.maxToolsPerStep) ? await deps.ranker.rank(state.text, allowed) : [];
  return {
    tools: selectTools({
      tools: allowed,
      domains: state.screen.domains,
      route: state.page?.route,
      ranked,
      cap: RUN_LIMITS.maxToolsPerStep,
    }),
  };
}

export const isBlocked = (screen: Screen) => screen.blocked;
