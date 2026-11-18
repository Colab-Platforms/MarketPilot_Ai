# ADR 0005: LangGraph.js as the agent runtime, behind our own model, tool and storage boundaries

Status: accepted, 2026-11-17 (proposed 2026-11-16).

## Context
The copilot (`docs/COPILOT_AGENT.md`) and later the strategist and creative agents need: a tool-calling loop, pauses for owner approval that resume hours later, step-level persistence for replay, token streaming with intermediate events, and subgraphs. ARCHITECTURE.md section 6 already describes agents as step graphs with persisted step state. Python services are deferred (section 11), so the runtime must be TypeScript.

## Decision
- Use `@langchain/langgraph` (JS) for graph orchestration only: state, nodes, conditional edges, `interrupt` and resume, subgraphs and stream events.
- **No LangChain model wrappers or provider SDKs.** The model node calls `AiService.converse()`, which goes through `LlmPort` and OpenRouter (ADR 0004). CLAUDE.md rule 1 is unchanged.
- **Our own checkpointer** implements LangGraph's checkpoint saver interface on Prisma (`agent_checkpoint`) inside the tenant transaction, so RLS applies. We do not use the library's Postgres checkpointer, which manages its own schema outside Prisma Migrate.
- Tools are our `ToolDefinition` registry (Zod contracts, RBAC, idempotency). They are adapted to the graph at the edge.
- Pin exact versions, and read the current LangGraph.js docs before implementing, since its API moves quickly.

## Alternatives
A hand-written loop over BullMQ and DB state machines needs no new dependency, but we would rebuild interrupt and resume, checkpoint replay, stream events and subgraph composition ourselves. That is roughly two to three weeks for one engineer, and an ongoing maintenance load.

## Consequences
- New dependencies, pinned exactly, in `apps/api` only: `@langchain/langgraph` 1.7.4, its peer `@langchain/core` 1.4.1, and `@langchain/langgraph-checkpoint` 1.2.3 (already a LangGraph dependency; declared directly because our checkpointer needs its write-ordering helpers).
- Every node is a plain function over typed state. If the library becomes a burden, the graph can be replaced by a hand-written loop without touching tools, prompts or storage.
- Lint rule (in `eslint.config.mjs`): `@langchain/*` imports are allowed only under `modules/agents/runtime` and `modules/agents/*/graph`.
- Checkpoints use a second table, `agent_checkpoint_write`, for writes made between checkpoints, as the saver contract requires.
