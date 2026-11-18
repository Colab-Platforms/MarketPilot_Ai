# ADR 0004: OpenRouter as the LLM and embeddings gateway, behind LlmPort

Status: accepted, 2026-11-13.

## Context
Profile extraction from website content (structured output) and embeddings need hosted models. Phase 1 has one or two engineers, so one billing and key surface is preferable to several provider accounts. ARCHITECTURE.md already requires every provider behind `LlmPort` (infra/llm-providers), reached only through `modules/ai`.

## Decision
- One adapter, `OpenRouterAdapter`, implements `LlmPort` with plain `fetch` (no SDK, no new dependency): `generateStructured` (chat completions with a strict JSON schema) and `embed` (`/embeddings`).
- Models come from environment variables, never from callers: `OPENROUTER_MODEL_EXTRACT` (default `anthropic/claude-haiku-5.5`) and `OPENROUTER_MODEL_EMBED` (default `openai/text-embedding-3-large`, `dimensions=1024` per ADR 0002).
- **Privacy is strict by default.** Every request sends `provider.zdr: true` and `provider.data_collection: "deny"`, so only zero-data-retention providers that do not train on inputs are used. Structured requests also send `provider.require_parameters: true` so a provider that ignores the JSON schema is never chosen. If no provider satisfies this, the request fails with a clear error; it is never silently retried with weaker privacy. `OPENROUTER_PRIVACY=standard` exists for local experiments and must not be used in production.
- Only business content is sent: public website text and the brand's own profile values. Never the owner's name, email or credentials.
- All model output is untrusted: validated against the field registry, and every "stated" claim must be backed by a quote that exists in the crawled text. AI output is only ever a candidate for owner review (CLAUDE.md rule 3).
- Usage (tokens and OpenRouter's reported cost) is stored with each scan. Run limits and credits are deliberately not enforced yet; they arrive with billing (M13).
- With no `OPENROUTER_API_KEY`, the adapter reports itself unavailable and callers skip the AI step; the deterministic scan still works.

## Consequences
- OpenRouter is a subprocessor: its terms and the terms of each routed provider apply (BUSINESS_BRAIN section 11).
- Strict privacy narrows the model pool and can raise cost or fail for models without a ZDR endpoint. Verify with a live call when the key is first set.
- Structured-output support varies by provider; our own validation is the real guarantee.
- Switching gateway or going direct to Anthropic or OpenAI is a new adapter, not a code change in callers.
