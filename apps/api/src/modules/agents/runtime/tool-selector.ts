import type { AnyTool, ToolDomain } from '@/common';
import { ALWAYS_ON_TOOLS } from './run-limits';

export interface SelectionInput {
  // Tools the role may use.
  tools: readonly AnyTool[];
  // From the router, most relevant first.
  domains: readonly ToolDomain[];
  route: string | undefined;
  // Tool names by similarity to the message, best first. Empty when ranking was skipped.
  ranked: readonly string[];
  cap: number;
}

export function needsRanking(tools: readonly AnyTool[], cap: number): boolean {
  return tools.length > cap;
}

// Which tools the model sees this turn (docs/COPILOT_AGENT.md section 4). Below the cap every
// allowed tool is offered; above it: always-on tools, then tools for the current page, then the
// router's domains, then the similarity rank, cut at the cap.
export function selectTools(input: SelectionInput): string[] {
  const names = input.tools.map((tool) => tool.name);
  if (!needsRanking(input.tools, input.cap)) return names;

  const allowed = new Set(names);
  const onPage = input.route
    ? input.tools.filter((t) => t.pages?.some((prefix) => input.route?.startsWith(prefix))).map((t) => t.name)
    : [];
  const inDomains = input.domains.flatMap((domain) => input.tools.filter((t) => t.domain === domain).map((t) => t.name));

  const ordered = [...ALWAYS_ON_TOOLS, ...onPage, ...inDomains, ...input.ranked].filter((name) => allowed.has(name));
  return [...new Set(ordered)].slice(0, input.cap);
}
