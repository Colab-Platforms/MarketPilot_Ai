import { Injectable } from '@nestjs/common';
import type { AnyProposeTool, Proposal, ToolContext } from '@/common';

export type GateVerdict = 'auto' | 'ask' | 'deny';

// Decides whether a proposal runs, waits for the owner, or is refused (CLAUDE.md rule 3).
@Injectable()
export class ExecutionGate {
  evaluate(ctx: ToolContext, tool: AnyProposeTool, _proposal: Proposal): GateVerdict {
    if (!tool.roles.includes(ctx.role)) return 'deny';
    // Owner decision 2026-11-17: every copilot write asks first, whatever the autonomy level.
    // `auto` stays in the contract so autonomy levels can relax this without touching tools.
    return 'ask';
  }
}
