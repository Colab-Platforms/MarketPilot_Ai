import type { ModelTier } from './task-definition';

// Which tier serves each conversational task. Models per tier are configuration (ADR 0004).
export const CONVERSE_TASKS = {
  'copilot.turn': 'reasoning',
} as const satisfies Record<string, ModelTier>;

export const STRUCTURED_TASKS = {
  'copilot.screen': 'classification',
  'copilot.suggest': 'classification',
  'copilot.summarize': 'writing',
} as const satisfies Record<string, ModelTier>;

export type ConverseTask = keyof typeof CONVERSE_TASKS;
export type StructuredTask = keyof typeof STRUCTURED_TASKS;
