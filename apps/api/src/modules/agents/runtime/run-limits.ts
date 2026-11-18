// Hard limits per run (docs/COPILOT_AGENT.md section 3). Hitting one ends the run with a clear
// message, never a silent stop.
export const RUN_LIMITS = {
  maxSteps: 8,
  // Prompt plus completion tokens across every model call in the run.
  maxTokens: 80_000,
  wallClockMs: 120_000,
  // Tools offered to the model in one step (section 4).
  maxToolsPerStep: 15,
  // Invalid-argument errors returned to the model before the run gives up.
  maxInvalidArgs: 2,
  // Credits a run may spend without asking. Unset until billing ships (owner decision
  // 2026-11-17): every credit-spending tool asks.
  autoSpendCredits: 0,
} as const;

// Tools offered on every step whatever the router picks.
export const ALWAYS_ON_TOOLS = ['tools.search', 'brain.search'] as const;
