# MarketPilot AI

AI-native marketing automation for local businesses and SMBs (India first). A URL and a budget become a running marketing engine: plan, create, approve, publish, measure, learn. The owner stays in control through graduated autonomy.

Source documents: `MarketPilot_AI_Scope_of_Work.pdf` (full scope), `ARCHITECTURE.md` (how we build it), `DESIGN.md` (UI system), `docs/BUSINESS_BRAIN.md` (memory and knowledge system design, read before touching anything in `modules/memory` or the AI context pipeline). `docs/ONBOARDING.md` (registration, account types, website scan and review flow, read before touching onboarding or the crawler). `docs/COPILOT_AGENT.md` (copilot agent graph, tool registry, approvals, read before touching `modules/agents` or adding agent tools). Read the relevant one before starting work in its area.

## Team and constraints

- 1-2 engineers. Every decision favours fewer moving parts. Do not add infrastructure, services or libraries without a written reason in `docs/adr/`.
- Beachhead: Indian local businesses and SMBs on Instagram, Facebook and WhatsApp. D2C performance and ads come later.
- Data residency is undecided. Keep storage, queue, LLM and email providers behind interfaces so region can change.

## Stack (fixed unless an ADR says otherwise)

- Monorepo: pnpm workspaces + Turborepo, TypeScript strict everywhere.
- `apps/web`: Next.js (App Router), Tailwind, Radix primitives, TanStack Query, Zustand, Zod.
- `apps/api`: NestJS on Node 22. The same codebase boots as API (`main.ts`) or worker (`worker.ts`).
- Database: PostgreSQL 16 + pgvector.
- ORM: Prisma (client, migrations, schema as the data model source of truth). Raw SQL only for what Prisma cannot express (pgvector search, RLS policies, full-text ranking), always in typed repository wrappers.
- Queue: BullMQ on Redis. Temporal, ClickHouse and Python services are deferred (see ARCHITECTURE.md section 11).
- Object storage: S3-compatible, behind `StoragePort`.
- Observability: OpenTelemetry, Sentry, Langfuse for LLM traces.

## Repository layout

```
apps/web                 Next.js app (customer + internal admin under /admin, role-gated)
apps/api                 NestJS app and worker entrypoint
packages/contracts       Zod schemas and TS types shared by web and api
packages/ui              Design system: tokens, primitives, patterns
packages/config          eslint, tsconfig, tailwind preset
docs/adr                 Architecture decision records
```

## Architecture rules (enforced by lint and review)

1. **AI behind one door.** No code outside `modules/ai` imports a model provider SDK. Callers request a task (`caption.generate`), never a model.
2. **All memory access goes through `MemoryService`.** No feature reads or writes Brand Brain tables directly.
3. **Propose versus execute.** AI returns structured proposals. Deterministic code validates (role, autonomy level, guardrails, credits) and executes. AI never calls an external side effect directly.
4. **Module boundaries.** Each folder in `apps/api/src/modules/*` exposes only its `index.ts` public API. Cross-module imports of internals are lint errors.
5. **Tenancy.** Every tenant table has `workspace_id` (and `brand_id` where relevant). Postgres RLS is on. Every request runs in a transaction that sets the tenant session variable. Cross-tenant tests must pass in CI.
6. **Idempotency.** Every job and every mutating endpoint that spends credits or touches a platform carries an idempotency key.
7. **Platform is source of truth** for posts and ads. We mirror and reconcile; we never assume a call succeeded.
8. **Validation at every boundary** with Zod schemas from `packages/contracts`. LLM output is validated against a schema before use.
9. **Credits are an append-only ledger.** Reserve, then settle. No updating balances in place.
10. **Secrets and tokens.** OAuth tokens are envelope-encrypted, never sent to the browser, never logged.

## Code standards

- Names carry the meaning. Prefer small functions, early returns, explicit types at module boundaries, no `any`.
- Comments only for non-obvious why (a platform quirk, an invariant, a workaround). Never narrate what the code does. No line-by-line commentary, no commented-out code, no TODOs without a ticket reference.
- One responsibility per file. Files over about 250 lines need a reason.
- Errors: typed domain errors mapped to the error envelope; never swallow exceptions.
- Tests: unit tests for domain logic, integration tests with Testcontainers for DB and queues, Playwright for core journeys, contract tests per connector. A bug fix starts with a failing test.
- Commits: conventional commits, small and focused. Never commit secrets or `.env`.

## UI standards

All UI follows `DESIGN.md`. Use tokens only: no raw hex, no arbitrary pixel values, no new font sizes. Reuse components from `packages/ui`; add a new primitive there before building a one-off. Every screen needs loading, empty, error and success states, keyboard access and mobile (360 px) layout.

## Working agreements

- Check `ARCHITECTURE.md` and existing modules before adding code. Extend, do not duplicate.
- Third-party API details (Meta, Google, WhatsApp, Razorpay) change often: read current official docs before implementing a connector.
- Ask before: adding a dependency with a large footprint, changing the data model of memory or credits, or anything that spends real money or posts to real accounts.
- Prefer the smallest change that meets the acceptance criteria in the scope document.

## Current phase

Phase 1 lean MVP. In scope: M1 identity and tenancy, M2 Brand Brain, M3 text, image and template reels, M4 basic library, M5 calendar and planner, M6 Facebook and Instagram publishing, M8 copilot, strategist and creative agents, M9 organic analytics, M13 billing and credits (Razorpay), PWA. Everything else is deferred; see ARCHITECTURE.md section 12.
