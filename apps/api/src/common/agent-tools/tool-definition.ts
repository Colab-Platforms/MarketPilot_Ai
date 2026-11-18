import type { ZodType, ZodTypeDef } from 'zod';
import type { ApprovalBlock, UiBlock, WorkspaceRole } from '@marketpilot/contracts';

// The copilot's reach (docs/COPILOT_AGENT.md section 5). Every module that ships a feature
// contributes the tools for it; each tool calls the module's own services, never tables.

export type ToolKind = 'read' | 'generate' | 'propose';

export type ToolDomain = 'brain' | 'profile' | 'content' | 'calendar' | 'publishing' | 'analytics' | 'billing' | 'meta';

// Built from the authenticated session, never from model output.
export interface ToolContext {
  workspaceId: string;
  brandId: string;
  userId: string;
  role: WorkspaceRole;
  runId: string;
  // hash(runId, step, tool, args): a retried step cannot repeat a side effect.
  idempotencyKey: string;
  signal: AbortSignal;
}

// What a propose tool returns. Nothing changes until the owner approves and
// ExecutionService calls the tool's `execute`.
export interface Proposal<TPayload = unknown> {
  title: string;
  summary: string;
  changes: ApprovalBlock['changes'];
  credits: number;
  payload: TPayload;
}

interface ToolBase<TArgs> {
  // Dotted, domain first: 'brain.search', 'profile.get'.
  name: string;
  domain: ToolDomain;
  // Written for the model: what it does, when to use it, and when not to.
  description: string;
  // Shown to the owner while it runs: "Checking your business profile".
  label: string;
  args: ZodType<TArgs, ZodTypeDef, unknown>;
  // Roles that may use it. Tools a role cannot use are never offered to the model.
  roles: readonly WorkspaceRole[];
  // Route prefixes where this tool is most likely wanted, such as '/brand'.
  pages?: readonly string[];
}

export interface ReadToolDefinition<TArgs, TResult> extends ToolBase<TArgs> {
  kind: 'read' | 'generate';
  run(ctx: ToolContext, args: TArgs): Promise<TResult>;
  // What goes back to the model: short, plain, and never secrets or other tenants' data.
  summarize(result: TResult): string;
  render?(result: TResult): UiBlock | null;
}

export interface ProposeToolDefinition<TArgs, TPayload> extends ToolBase<TArgs> {
  kind: 'propose';
  propose(ctx: ToolContext, args: TArgs): Promise<Proposal<TPayload>>;
  // Runs only after approval, with the stored payload. Returns a sentence for the model.
  execute(ctx: ToolContext, payload: TPayload): Promise<string>;
}

// Variance across tool argument types is erased at the registry boundary; arguments are
// re-validated with the tool's own schema before every call.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyReadTool = ReadToolDefinition<any, any>;
export type AnyProposeTool = ProposeToolDefinition<any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */
export type AnyTool = AnyReadTool | AnyProposeTool;

// A module's contribution, exported from its index.ts and collected by modules/agents at boot.
export interface AgentToolSource {
  tools(): AnyTool[];
}

export const ALL_ROLES: readonly WorkspaceRole[] = ['owner', 'admin', 'manager', 'creator', 'approver', 'analyst', 'client'];
export const EDIT_ROLES: readonly WorkspaceRole[] = ['owner', 'admin', 'manager'];
