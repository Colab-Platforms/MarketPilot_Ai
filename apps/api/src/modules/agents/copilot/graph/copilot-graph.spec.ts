import { MemorySaver } from '@langchain/langgraph';
import type { PendingAction } from '@prisma/client';
import { z } from 'zod';
import type { CopilotEvent } from '@marketpilot/contracts';
import { EDIT_ROLES, ALL_ROLES, type AgentToolSource, type AnyTool } from '@/common';
import type { AiService, ConverseInput, ConverseResult } from '@/modules/ai';
import type { MemoryService } from '@/modules/memory';
import type { ConversationStore } from '../../conversations/conversation-store';
import { ExecutionGate } from '../../runtime/execution-gate';
import { ExecutionService } from '../../runtime/execution.service';
import type { NewPendingAction, RunStore } from '../../runtime/run-store';
import type { ToolRanker } from '../../runtime/tool-ranker';
import { ToolRegistry } from '../../runtime/tool-registry';
import { ToolRunner } from '../../runtime/tool-runner';
import { buildCopilotGraph, resumeWith } from './copilot-graph';
import type { CopilotDeps } from './deps';
import type { ApprovalInterrupt } from './state';

const usage = { model: 'test-model', promptTokens: 10, completionTokens: 5, costUsd: 0 };

class FakeRunStore {
  actions = new Map<string, PendingAction>();
  toolCalls: { name: string; status: string }[] = [];

  async recordToolCall(record: { name: string; status: string }) {
    this.toolCalls.push({ name: record.name, status: record.status });
  }
  async createPendingAction(input: NewPendingAction) {
    const id = `00000000-0000-4000-8000-00000000000${this.actions.size + 1}`;
    const row = {
      id,
      toolName: input.toolName,
      proposal: input.proposal.payload,
      status: 'pending',
      idempotencyKey: input.idempotencyKey,
      result: null,
    } as unknown as PendingAction;
    this.actions.set(id, row);
    return row;
  }
  async findPendingAction(_workspaceId: string, id: string) {
    return this.actions.get(id) ?? null;
  }
  async settleAction(_workspaceId: string, id: string, outcome: { ok: boolean; message: string }) {
    const row = this.actions.get(id);
    if (row) Object.assign(row, { status: outcome.ok ? 'executed' : 'failed', result: { message: outcome.message } });
  }
  approve(id: string) {
    const row = this.actions.get(id);
    if (row) row.status = 'approved';
  }
  async addUsage() {}
}

function tools(executed: unknown[]): AgentToolSource {
  const lookup: AnyTool = {
    name: 'test.lookup',
    domain: 'brain',
    kind: 'read',
    label: 'Looking it up',
    description: 'Look something up.',
    args: z.object({ query: z.string().min(1) }).strict(),
    roles: ALL_ROLES,
    run: async (_ctx, args: { query: string }) => ({ found: `opening hours for ${args.query}: 10 to 8` }),
    summarize: (result: { found: string }) => result.found,
  };
  const propose: AnyTool = {
    name: 'profile.propose_update',
    domain: 'profile',
    kind: 'propose',
    label: 'Preparing a change',
    description: 'Propose a profile change.',
    args: z.object({ tagline: z.string().min(1) }).strict(),
    roles: EDIT_ROLES,
    propose: async (_ctx, args: { tagline: string }) => ({
      title: 'Update your tagline',
      summary: 'A shorter tagline',
      changes: [{ label: 'Tagline', before: 'Old', after: args.tagline }],
      credits: 0,
      payload: { tagline: args.tagline },
    }),
    execute: async (_ctx, payload: { tagline: string }) => {
      executed.push(payload);
      return 'Your tagline is updated.';
    },
  };
  return { tools: () => [lookup, propose] };
}

const toolCall = (id: string, name: string, args: unknown) => ({ id, name, arguments: JSON.stringify(args) });
const reply = (content: string, toolCalls: ConverseResult['toolCalls'] = []): ConverseResult => ({
  content,
  toolCalls,
  finishReason: toolCalls.length ? 'tool_calls' : 'stop',
  usage,
});

function setup(script: (input: ConverseInput, call: number) => ConverseResult, options: { blocked?: boolean } = {}) {
  const executed: unknown[] = [];
  const runs = new FakeRunStore();
  const registry = new ToolRegistry([tools(executed)]);
  const execution = new ExecutionService(registry, runs as unknown as RunStore);
  const runner = new ToolRunner(registry, new ExecutionGate(), execution, runs as unknown as RunStore);
  const conversed: ConverseInput[] = [];
  const ai = {
    available: true,
    converse: async (_task: string, input: ConverseInput) => {
      conversed.push(input);
      const result = script(input, conversed.length);
      if (result.content) input.onText?.(result.content);
      return result;
    },
    structured: async (task: string) => ({
      data: task === 'copilot.screen' ? { verdict: options.blocked ? 'block' : 'allow', domains: ['brain'] } : { suggestions: ['What else?'] },
      usage,
    }),
  } as unknown as AiService;

  const deps: CopilotDeps = {
    run: {
      workspaceId: 'w',
      brandId: 'b',
      userId: 'u',
      role: 'owner',
      runId: 'run-1',
      conversationId: 'c',
      brandName: 'Kala Sarees',
      signal: new AbortController().signal,
    },
    ai,
    memory: { buildContext: async () => ({ text: 'Brand: Kala Sarees, Pune' }) } as unknown as MemoryService,
    conversations: { history: async () => ({ summary: null, recent: [] }) } as unknown as ConversationStore,
    registry,
    ranker: { rank: async () => [] } as unknown as ToolRanker,
    runner,
    execution,
    runs: runs as unknown as RunStore,
  };
  const graph = buildCopilotGraph(deps, new MemorySaver());
  const config = { configurable: { thread_id: 'run-1' } };

  async function drive(input: Parameters<typeof graph.stream>[0]): Promise<CopilotEvent[]> {
    const events: CopilotEvent[] = [];
    for await (const event of await graph.stream(input, { ...config, streamMode: 'custom' })) events.push(event as CopilotEvent);
    return events;
  }
  async function interrupted(): Promise<ApprovalInterrupt | undefined> {
    const state = await graph.getState(config);
    return state.tasks.flatMap((t) => t.interrupts)[0]?.value as ApprovalInterrupt | undefined;
  }
  const start = { text: 'When are you open?', page: { route: '/home' }, userMessageId: 'm1' };
  return { drive, interrupted, start, conversed, executed, runs };
}

const texts = (events: CopilotEvent[]) =>
  events.flatMap((e) => (e.type === 'text.delta' ? [e.text] : [])).join('');

describe('copilot graph', () => {
  it('calls a read tool, feeds the result back, then answers and suggests follow-ups', async () => {
    const t = setup((_input, call) =>
      call === 1 ? reply('', [toolCall('c1', 'test__lookup', { query: 'store' })]) : reply('We are open 10 to 8.'),
    );
    const events = await t.drive(t.start);

    expect(events.map((e) => e.type)).toEqual(['tool.started', 'tool.finished', 'text.delta', 'suggestions']);
    expect(texts(events)).toBe('We are open 10 to 8.');
    const second = t.conversed[1]?.messages ?? [];
    expect(second.at(-1)).toEqual({ role: 'tool', toolCallId: 'c1', content: 'opening hours for store: 10 to 8' });
    expect(t.conversed[0]?.tools.map((s) => s.name)).toEqual(['test__lookup', 'profile__propose_update', 'tools__search']);
    expect(await t.interrupted()).toBeUndefined();
  });

  it('pauses on a proposal, and executes it only after the owner approves', async () => {
    const t = setup((_input, call) =>
      call === 1 ? reply('Here is a shorter one.', [toolCall('c1', 'profile__propose_update', { tagline: 'Handloom, honestly' })]) : reply('Saved.'),
    );
    await t.drive(t.start);

    const pause = await t.interrupted();
    expect(pause?.block).toMatchObject({ type: 'approval', title: 'Update your tagline', status: 'pending' });
    expect(t.executed).toEqual([]);
    expect(t.conversed).toHaveLength(1);

    t.runs.approve(pause?.actionId ?? '');
    const events = await t.drive(resumeWith({ decision: 'approve' }));

    expect(t.executed).toEqual([{ tagline: 'Handloom, honestly' }]);
    expect(t.conversed[1]?.messages.at(-1)).toEqual({ role: 'tool', toolCallId: 'c1', content: 'Done. Your tagline is updated.' });
    expect(texts(events)).toBe('Saved.');
    expect(await t.interrupted()).toBeUndefined();
  });

  it('never executes a rejected proposal and tells the model why', async () => {
    const t = setup((_input, call) =>
      call === 1 ? reply('', [toolCall('c1', 'profile__propose_update', { tagline: 'X' })]) : reply('Okay, left as is.'),
    );
    await t.drive(t.start);
    await t.drive(resumeWith({ decision: 'reject', note: 'too short' }));

    expect(t.executed).toEqual([]);
    expect(t.conversed[1]?.messages.at(-1)?.content).toContain('rejected');
    expect(t.conversed[1]?.messages.at(-1)?.content).toContain('too short');
  });

  it('stops offering tools on the last allowed step', async () => {
    const t = setup((input, call) =>
      input.tools.length > 0 ? reply('', [toolCall(`c${call}`, 'test__lookup', { query: `q${call}` })]) : reply('Here is what I found.'),
    );
    const events = await t.drive(t.start);

    expect(t.conversed).toHaveLength(8);
    expect(t.conversed[7]?.tools).toEqual([]);
    expect(texts(events)).toBe('Here is what I found.');
  });

  it('refuses a blocked message without calling the agent model', async () => {
    const t = setup(() => reply('should not run'), { blocked: true });
    const events = await t.drive(t.start);

    expect(t.conversed).toHaveLength(0);
    expect(events).toEqual([{ type: 'text.delta', text: expect.stringContaining("can't help") }]);
  });

  it('returns an error to the model for a tool it was not offered', async () => {
    const t = setup((_input, call) =>
      call === 1 ? reply('', [toolCall('c1', 'publish__propose_now', {})]) : reply('I cannot do that yet.'),
    );
    await t.drive(t.start);

    expect(t.conversed[1]?.messages.at(-1)?.content).toMatch(/^Error: publish.propose_now is not available/);
    expect(t.runs.toolCalls).toEqual([{ name: 'publish.propose_now', status: 'denied' }]);
  });
});
