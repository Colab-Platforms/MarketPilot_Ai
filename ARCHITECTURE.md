# MarketPilot AI Architecture

Version 1.0. Companion to `CLAUDE.md` (rules) and `DESIGN.md` (UI). Scope source: `MarketPilot_AI_Scope_of_Work.pdf`.

## 1. System overview

A multi-tenant, event-driven modular monolith. One NestJS codebase with strict module boundaries runs in two modes: API and worker. A Next.js app is the only first-party client at MVP (PWA for mobile).

```
Browser / PWA (Next.js)
        |  REST + SSE
   API (NestJS)  ------------ Redis (BullMQ, cache, locks, rate buckets)
        |                          |
   Modules ----- AI layer          Worker (NestJS, same code)
        |           |                 |  publish, generate, sync, embed
   PostgreSQL + pgvector       External: Meta, LLM and media providers, Razorpay, S3
```

Principles: AI behind one door; propose versus execute; platform is source of truth; idempotent async work; tenant isolation by design; observable by default.

## 2. Repository layout

```
apps/
  web/                    Next.js: app/(marketing), app/(app), app/admin
  api/
    src/
      main.ts             HTTP bootstrap
      worker.ts           queue consumers bootstrap
      common/             guards, interceptors, errors, tenancy context, idempotency
      modules/
        identity/         auth, sessions, workspaces, memberships, RBAC
        brand/            brands, brand kit, goals, festivals
        memory/           Brand Brain (section 4)
        ai/               gateway, prompts, routing, guardrails, evals (section 5)
        studio/           caption, image, reel, carousel generation jobs
        assets/           library, renditions, search
        calendar/         items, planner, campaigns, approvals
        publishing/       connectors, scheduler, publish jobs, reconciliation
        analytics/        sync, snapshots, digest
        agents/           strategist, creative, copilot, autonomy, run logs
        billing/          plans, credits ledger, Razorpay, invoices
        notifications/    in-app, email, push
        admin/            tenant tools, AI ops, integration health
      infra/              prisma, redis, storage, queue, llm-providers, platform adapters
    prisma/               schema.prisma, migrations, rls.sql
packages/
  contracts/              Zod schemas, DTO types, error codes, event types
  ui/                     tokens, primitives, patterns
  config/                 eslint, tsconfig, tailwind preset
docs/adr/
```

Module rule: other modules may import only `modules/<name>/index.ts`. Ports (interfaces) live in the module that needs them; adapters live in `infra/`.

## 3. Data and tenancy

- PostgreSQL 16 with `pgvector`, hosted on Neon in AWS Singapore (ADR 0001): pooled URL for the app, direct URL for migrations. Prisma is the ORM: `schema.prisma` is the source of truth for the data model, and Prisma Migrate owns all schema changes.

### 3.1 Prisma conventions

- One `PrismaService` in `infra/prisma`. Modules never import `PrismaClient` directly; each module owns repository classes that wrap Prisma and return domain types, not Prisma models, across the module boundary.
- Tenancy: a request-scoped transaction runs `SELECT set_config('app.workspace_id', $1, true)` first, and repositories use that transaction client. Workers do the same from the job payload. A lint rule forbids using the root client for tenant tables.
- Raw SQL (`$queryRaw` with tagged templates, never string concatenation) is allowed only for pgvector similarity, hybrid search ranking and RLS policies. Vector columns are declared as `Unsupported("halfvec(1024)")` in the schema (dimension fixed by ADR 0002) and handled in `MemoryStore` only.
- Migrations: `prisma migrate dev` locally, `prisma migrate deploy` in CI/CD. Policies, extensions and HNSW indexes live in hand-edited SQL migrations (`rls.sql` is applied through a migration, not manually). Use expand-and-contract for any breaking change.
- Money and credits use `Decimal` or integer minor units, never `Float`. Timestamps are `DateTime` in UTC. IDs are UUIDv7 generated in the application.
- Soft delete only where the domain needs it (memory chunks, assets); everywhere else hard delete with audit events.
- Avoid N+1 queries: use `select` and `include` deliberately, and add indexes in the schema for every foreign key and common filter.
- Prisma Client types are used inside repositories only; shared DTOs and validation come from `packages/contracts`.
- Every tenant table: `workspace_id`, optional `brand_id`, `created_at`, `updated_at`. UUIDv7 primary keys.
- RLS policy on every tenant table keyed to `current_setting('app.workspace_id')`. A request interceptor opens a transaction and sets it; background jobs set it from the job payload. The application role has no `BYPASSRLS`.
- Times stored UTC plus the brand IANA time zone for display and scheduling.
- Append-only tables: `credit_ledger`, `audit_event`, `memory_event`, `post_version`.
- Core entities follow scope section 13. Additions: `memory_*` tables (section 4), `outbox_event`, `idempotency_key`.

## 4. Brand Brain (memory system)

> The detailed design is in `docs/BUSINESS_BRAIN.md` ("Business Brain" and "Brand Brain" are the same system). Where it is more specific than this section (separate embeddings table, versioned source/extraction/chunk records, write-policy statuses and confidence, retrieval budgets, cache-key rules), that document wins. Section 14 of it maps its memory types onto the layers below.

The Brain is a service (`MemoryService`) over four layers. A vector index alone is insufficient: exact facts must be injected deterministically, similar past work must be retrieved, and learned patterns must be derived from outcomes.

### 4.1 Layers

| Layer | Content | Storage | Read mode |
|---|---|---|---|
| L1 Canonical profile | Voice, rules, banned words, legal phrases, languages, goals, palette, fonts, products, prices | `brand_profile` (versioned, JSONB + typed columns), `product` | Always injected, never retrieved |
| L2 Knowledge | Website pages, PDFs, FAQs, policies, catalog text | `memory_chunk` with embedding + `tsvector` | Hybrid search: vector + keyword, reranked |
| L3 Episodic | Every generation, post, ad: context bundle id, output, user edits, approval, publish result, metrics | `memory_event` (append-only) + `memory_episode` with embedding | Similarity retrieval filtered by outcome |
| L4 Insights | Distilled patterns with evidence and confidence | `memory_insight` | Injected when tagged relevant to task |

### 4.2 Provenance and trust

Every L1, L2 and L4 record carries `source` and `trust`:

`user_stated (3) > uploaded_or_crawled (2) > ai_inferred (1)`

Conflicts resolve by trust, then recency. User corrections always override and are recorded as events. **AI-generated content is never stored as a brand fact.** It enters L3 as a candidate episode. It contributes to learning only after approval and publication, weighted further by measured performance.

### 4.3 Write path

```
Producer (onboarding, upload, studio, publishing, analytics, user edit)
   -> memory_event (append-only) + outbox_event   [same transaction]
   -> worker: memory.ingest
        extract facts / chunk -> normalise -> dedupe (hash + near-duplicate) 
        -> embed (versioned model id) -> upsert chunk / episode
        -> conflict resolution by trust
   -> scheduled: memory.consolidate (nightly per active brand)
        outcome-labelled episodes -> candidate insights -> validate with min sample size
        -> upsert memory_insight (confidence, evidence ids, decay)
```

Rules: ingestion is idempotent by content hash; chunks are soft-deleted on change and superseded by version; embeddings record `embedding_model` and `embedding_version`; a model change builds a new index and swaps, never in-place rewrite.

### 4.4 Read path (context builder)

`MemoryService.buildContext(task, brandId, query)` returns a `ContextBundle`:

1. L1 core: voice, rules, banned words, legal phrases, language, relevant products. Always included, first.
2. Task-specific retrieval: L2 hybrid top-k and L3 similar successful episodes, filtered by `brand_id`, type, recency and outcome score.
3. L4 insights matching the task tags.
4. Fit to the task token budget in priority order (L1, L4, L3, L2). Drop lowest-ranked items first.

The bundle is deterministic for given inputs, stored as `context_bundle` (ids and hashes, not copies), and its id is saved on every generation. This gives audit ("why did it write this?") and replay.

### 4.5 Vector store decision

pgvector in the primary Postgres. `halfvec` columns, HNSW index, cosine distance. Hybrid ranking via reciprocal rank fusion of vector and `ts_rank` results.

Known limit: HNSW with a selective `brand_id` filter can return too few rows. Mitigations in order: `hnsw.iterative_scan`, composite or partial indexes for large brands, hash partitioning by workspace. Revisit when total vectors approach tens of millions or p95 retrieval exceeds 150 ms.

All access goes through `MemoryStore` (port) so L2 and L3 retrieval can move to a dedicated vector engine without touching callers.

```ts
interface MemoryStore {
  upsertChunks(brandId: string, chunks: ChunkInput[]): Promise<void>;
  searchChunks(brandId: string, query: SearchQuery): Promise<ScoredChunk[]>;
  recordEpisode(brandId: string, episode: EpisodeInput): Promise<string>;
  similarEpisodes(brandId: string, query: SearchQuery): Promise<ScoredEpisode[]>;
  deleteBySource(brandId: string, sourceId: string): Promise<void>;
}
```

### 4.6 Privacy and lifecycle

- Retrieval always filtered by workspace and brand; RLS enforces it again.
- Cross-tenant learning is off by default; anonymised aggregates are opt-in only.
- Erasure: every record keeps its source id, so deleting a source or brand hard-deletes derived chunks, episodes and insights (DPDP right to erasure).
- PII is redacted before text reaches logs and traces.
- Embeddings are `halfvec(1024)` (ADR 0002). The model is confirmed by a one-day Hindi, Hinglish and English recall benchmark before the first production index; the dimension does not change with the winner.
- Onboarding, account types and the website scan pipeline are specified in `docs/ONBOARDING.md`; the crawler is our own fetch plus Cheerio behind `CrawlerPort` (ADR 0003).

## 5. AI layer (`modules/ai`)

Callers use tasks. Pipeline for every request:

1. Authenticate, check tenant budget and credits (reserve).
2. Build context via `MemoryService`.
3. Render versioned prompt from the registry.
4. Cache and dedupe lookup (exact, later semantic).
5. Route to a model by task config (quality, latency, cost targets).
6. Call the provider adapter (streaming where useful).
7. Validate output against the task Zod schema and guardrails; retry or fall back on failure.
8. Trace to Langfuse, meter cost, settle credits, write episode to memory.

Task registry entry (config, not code):

```ts
{ id: 'caption.generate', promptVersion: '3', outputSchema: CaptionSetSchema,
  routing: { tier: 'writing', maxLatencyMs: 6000, fallback: ['writing-alt'] },
  memory: { l1: true, l2: ['product','faq'], l3: 'top_performing', l4: ['hooks','tone'] },
  credits: 1 }
```

- Provider adapters in `infra/llm-providers`: `LlmPort` (text, structured, vision, embeddings), `ImagePort`, `SpeechPort`, `VideoPort`. Each adapter is replaceable and tested against a recorded fixture.
- Guardrails: prompt-injection screening for crawled and inbound text, claim detection (health, finance, guaranteed results), banned words and legal phrases from L1, ad-policy rules. A blocking flag prevents scheduling at every autonomy level.
- Evals: golden sets per task and language, run in CI on prompt or model change. Online metrics (edit rate, approval rate, publish rate) per prompt version.
- Cost control: per-tenant and per-task budgets with hard stops, caching, small models for classification, and a published credit cost map.

## 6. Agents and autonomy

- Agents are step graphs over a tool registry with JSON-schema contracts, run as BullMQ jobs with persisted step state in `agent_run`, `agent_step`, `tool_call`.
- Tools that change external state exist only as `propose_*`. A separate `ExecutionService` checks role, autonomy level, guardrails and credits, then executes.
- Autonomy levels 0-3 stored per workspace and per channel; enforced centrally in `ExecutionService`. Default is Level 1. Ad actions are out of MVP scope.
- Every run has hard limits on steps, tokens and money. Runs are replayable from recorded model outputs.

## 7. Publishing (`modules/publishing`)

- Connector port per platform: `connect`, `refresh`, `publish`, `fetchInsights`, `health`, `subscribeWebhooks`. MVP adapters: Facebook Pages, Instagram Business.
- Scheduler: the DB is the schedule of record. A scanner enqueues items due in the next window; each job takes a lease; the job checks for an existing platform post id before calling the platform and stores the id in the same transaction that advances state.
- Retries with exponential backoff, dead-letter queue, typed error taxonomy (auth, rate limit, policy, validation, transient) mapped to retry, user action or escalation.
- Per-account token buckets in Redis. Tokens are checked before publish time and the user is prompted to reconnect.
- Daily reconciliation compares scheduled, queued and platform-visible items.
- Post state machine: Draft, In review, Approved, Scheduled, Publishing, Published; failure paths Retry wait, Failed; any state to Cancelled.

## 8. Billing and credits (`modules/billing`)

- Razorpay for India (UPI, cards, mandates); Stripe added with international launch. GST invoices.
- `credit_ledger` is double-entry style and append-only with a unique idempotency key. Long jobs reserve, then settle. Balance is derived, with a cached snapshot.
- Plans and limits (brands, seats, channels, credits) live in config and are enforced by a single `EntitlementService`.

## 9. API conventions

- REST over HTTPS, OpenAPI 3.1 generated from NestJS, `/v1` prefix, cursor pagination, consistent error envelope with machine codes.
- `Idempotency-Key` required on mutating endpoints that spend credits or touch platforms.
- Auth: short-lived JWT access token, rotating refresh token in an httpOnly cookie, session list and revoke. Argon2id hashing. Google sign-in and phone OTP.
- Long operations return a job id; progress over SSE at `/v1/jobs/{id}/events`.
- RBAC roles: Owner, Admin, Manager, Creator, Approver, Analyst, Client. Permission checks in guards; deny by default.

## 10. Security baseline

- OWASP ASVS L2 target; Zod validation on all input; strict CSP; CSRF protection for cookie flows; SSRF protection for the crawler (block private ranges, resolve then connect, size and time limits, respect robots.txt).
- Envelope encryption for OAuth tokens via a `KeyPort` (KMS adapter); secrets from environment or secret manager only.
- Immutable audit log for connections, publishing, role changes, billing.
- Webhooks: signature verification, replay protection, dedupe.
- Dependency scanning, secret scanning, SBOM in CI. Pen test before public launch.

## 11. Deferred infrastructure

| Item | Trigger to adopt | Interim |
|---|---|---|
| Temporal | Ad launches and long agent runs need durable multi-day workflows | BullMQ plus DB state machines |
| ClickHouse | Metric rows or dashboard queries exceed Postgres comfort | Postgres partitioned `metric_snapshot` plus rollup tables |
| Python service | Product-fidelity scoring or heavy CV needed | Provider vision APIs from Node |
| Dedicated vector DB | Section 4.5 thresholds | pgvector |
| EKS and microservices | Team and scale justify it | Single container image, API and worker modes |
| OpenSearch | Postgres FTS inadequate | Postgres FTS |

## 12. Roadmap for a 1-2 engineer team

Dates assume focused full-time work and slip with platform approvals. Applications for Meta business verification and app review should be filed in week 1 because they gate publishing.

| Stage | Contents | Exit |
|---|---|---|
| 0. Foundations | Monorepo, CI, Docker Compose, design tokens, auth, tenancy with RLS, RBAC, audit, job infra | Login, workspace, brand creation, CI green with cross-tenant tests |
| 1. Brain and Studio | M2 onboarding from URL, memory layers L1-L3, AI gateway, caption and image generation, credits ledger, asset library basics | URL to brand profile in under 90 s; generations carry a context bundle |
| 2. Plan and Publish | Calendar, AI 30-day planner, approvals, Facebook and Instagram publishing, scheduler, retries, reconciliation | Reliable publish soak test |
| 3. Learn and Earn | Insight sync, L4 consolidation, weekly digest, Razorpay billing and GST invoices, PWA, template reels | Closed beta with 10-30 workspaces |
| Later | Ads (Meta then Google), inbox and WhatsApp, landing pages, email, agency and white-label, native app, public API | Gated by beta results and hiring |

Deferred from MVP: M7 ads, M8 media buyer, analyst and community agents, M10 to M12, M14 beyond tenant tools and AI ops, M15 client links and WhatsApp approvals, M16 to M18, canvas editor, video editor lite. Generative product reels were pulled forward by the owner on 2026-11-20 (`docs/REEL_STUDIO.md`, ADR 0011).

## 13. Open decisions

1. ~~Data residency and cloud region~~ Decided: Neon, AWS Singapore (ADR 0001). Open item: counsel review of DPDP cross-border wording and a possible India region for enterprise.
2. LLM, image and speech providers (Phase 0 benchmark including Hindi and product-fidelity tests).
3. ~~Embedding dimension~~ Decided: 1024 (ADR 0002). Open item: final model from the Hindi and Hinglish benchmark (default `text-embedding-3-large` at 1024).
4. Product name, domain and trademark clearance (needed for platform app reviews).
5. Hosting target for early stage (managed container platform versus AWS ECS).
