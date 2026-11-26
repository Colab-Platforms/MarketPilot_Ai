# Registration and Onboarding Design

Status: approved design direction, schema not yet written. Version 1.0, 2026-11-13.
Read with `docs/BUSINESS_BRAIN.md` (memory system) and `ARCHITECTURE.md` section 3 (tenancy). Source: founder's Business Information Gathering brief (working name Scalio), adapted to this codebase. Decisions are recorded in `docs/adr/0001` to `0003`.

## 1. Goal

A URL (or a few answers) and a budget become a verified Brand profile that every AI feature reads through `MemoryService`. The owner never re-explains the business. Onboarding must reach first value (a draft content idea) before the profile is perfect, and must never be blocked by a failed scan.

## 2. Account model

One tenancy model, two tracks. No second product.

- Signup creates `User`, `Workspace`, `Membership(owner)` and the first `Brand`.
- `Workspace.accountType`: `creator | business`. It selects questions, extraction and defaults. The data model is identical.
- `Brand.scale`: `solo | small | mid | enterprise`. It gates team, approval-chain and multi-brand UI. Enterprise features stay hidden in Phase 1.

| | Creator | Business |
|---|---|---|
| Brand is | A person: niche, voice, content pillars | A company: products, services, policies, offers |
| Phase 1 source | Guided questionnaire plus uploads | Website scan plus questionnaire |
| Social scraping | Deferred (later; OAuth import is the preferred source) | Deferred; URLs are stored, accounts connect via OAuth |
| Team | Usually owner only | Owner, manager, creator, approver |

## 3. Flow

```
Sign up (email or phone OTP)
 1 Account type        creator | business
 2 Basics              name, website URL or "no website", city, language
 3 Scan (async)        business track only; user continues while it runs
 4 Goals               objective, budget, channels, autonomy level
 5 Review              approve, edit or reject extracted facts, by category
 6 Gaps                only questions the scan could not answer (category questionnaire)
 7 Connect             Meta OAuth, optional and skippable
 Done                  readiness summary, first content plan
```

Rules: one screen of questions at a time; progress saved after every step and resumable; everything skippable except account type and brand name; goals are asked while the scan runs because no website contains them. No website, a failed scan or a blocked site falls back to the questionnaire and document upload.

Autonomy default is "approve everything" (graduated autonomy, CLAUDE.md).

## 4. What lives where

**Main PostgreSQL is the source of truth. pgvector is a derived search index in the same database.**

| Question | Answered by | Examples |
|---|---|---|
| What is true? (exact, current, editable, auditable) | Relational tables | Price, name, hours, contact, policy text, approval status |
| What is related? (fuzzy, by meaning) | `knowledge_embedding` (halfvec) | "What do we say about sustainability?", similar products, past posts like this |

Vectors are rebuilt from chunks when the model changes; no truth is lost. A price always comes from `brand_product`, never from a vector hit.

### Relational tables

| Group | Tables |
|---|---|
| Identity (exist) | `user`, `workspace`, `membership`, `brand` |
| Canonical profile | `brand_profile`: typed columns for the stable core (about 30 fields) plus `attributes` JSONB validated by a per-category Zod schema in `packages/contracts` |
| Onboarding | `onboarding_session` (track, step, draft answers, completed steps) |
| Ingestion (BUSINESS_BRAIN section 9) | `knowledge_source`, `knowledge_document`, `knowledge_extraction`, `knowledge_chunk`, `knowledge_embedding`, `website_scan` |
| Entities | `brand_product`, `brand_service`, `brand_policy`, `brand_faq`, `brand_audience`, `brand_social_account`, `brand_competitor` (added with competitor discovery, ADR 0007) |
| Memory | `memory_fact`, `memory_preference`, `memory_decision`, `memory_event` (as designed) |

Why not 176 columns: about 30 stable fields become real columns; repeating things (products, FAQs, policies) are entity tables; the category long tail (menu, curriculum, amenities, fabric) is JSONB with a Zod schema per category, so adding "Travel" is a contracts change, not a migration.

### Provenance on every extracted or stated record

`source_type` (`user_stated | crawled | integration | ai_inferred`), `source_url`, `source_trust` (a rule-based score from source type and method; never the LLM's self-rating), `status` (`candidate | verified | rejected | stale`), `extracted_at`, `verified_at`, `content_hash`, `extraction_method`.

Promotion path: extraction (candidate) -> owner review -> entity or profile row (verified) -> chunk and embedding job. Facts and inferences are stored separately: "price is 1,499" is a fact; "appeals to young professionals" is an `ai_inferred` candidate and is never shown as verified.

## 5. Website extraction pipeline

```
POST scan -> SSRF-validate URL -> website_scan row -> BullMQ job
 1 Discover   robots.txt, sitemaps, homepage links, platform detection; cap 50 pages
 2 Fetch      own HTTP client, size and time limits, re-validate every redirect and resolved IP
 3 Parse      Cheerio: title, meta, Open Graph, JSON-LD (Product, LocalBusiness, FAQPage), images
 4 Platform   Shopify /products.json, WooCommerce Store API, schema.org first (exact, free)
 5 Classify   page type: home, about, product, service, contact, policy, faq
 6 Extract    deterministic results first; LLM with a Zod schema per page type fills gaps, batched
 7 Merge      dedupe by canonical URL, product id and content hash; resolve conflicts by trust
 8 Store      document, extraction (candidate), chunks; embedding jobs queued
 9 Review     owner approves, edits or rejects
```

- Crawler sits behind `CrawlerPort`. v1 adapter: own fetch plus Cheerio. A headless-browser adapter is added only when measured empty-page rate justifies it (ADR 0003).
- Page text is untrusted data. It is screened for prompt injection and never placed in an instruction position. LLM output is Zod-validated before use.
- Respect robots.txt, rate limits and login walls; never assume full extraction. Partial results are a normal outcome with a per-category completeness report.
- Recrawl is incremental by content hash (after v1). Changed pages re-extract and supersede; chunks are soft-deleted and versioned.
- Limits per scan: max pages, max bytes per page, total timeout, max LLM tokens; credits are reserved for LLM work (CLAUDE.md rule 9) and the scan job carries an idempotency key.

## 6. API (all under `/v1`, Zod contracts, idempotency key on mutating calls)

| Area | Endpoints |
|---|---|
| Onboarding | `POST /onboarding/sessions`, `GET /onboarding/sessions/:id`, `PATCH /onboarding/sessions/:id/steps/:step` |
| Brand | `POST /brands`, `GET /brands/:id`, `PATCH /brands/:id`, `GET /brands/:id/profile`, `PATCH /brands/:id/profile` |
| Scan | `POST /brands/:id/scans`, `GET /brands/:id/scans/:scanId`, `POST /brands/:id/scans/:scanId/cancel`; progress via SSE `/v1/jobs/{id}/events` |
| Review | `GET /brands/:id/extractions?category=`, `POST /extractions/:id/approve`, `POST /extractions/:id/reject`, entity PATCH endpoints |
| Questionnaire | `GET /brands/:id/questionnaire`, `POST /brands/:id/questionnaire/answers` |
| Social | start OAuth, callback, disconnect (tokens envelope-encrypted, never sent to the browser) |
| Readiness | `GET /brands/:id/readiness` (completeness per category) |

## 7. Pages (`apps/web`)

`/signup`, `/onboarding/type`, `/onboarding/basics`, `/onboarding/scan`, `/onboarding/goals`, `/onboarding/review/[category]`, `/onboarding/questions`, `/onboarding/connect`, `/onboarding/done`. After onboarding, `/brand/profile` reuses the review screens for ongoing editing. Each screen has loading, empty, error and success states, keyboard access and a 360 px layout.

## 8. Dynamic questionnaire

A question registry in `packages/contracts`: each question has an id, category scope, target field, Zod schema and a `skipIf` rule that checks whether a verified value already exists. The API returns the next unanswered questions only. Category packs: fashion, restaurant, real estate, healthcare, education, fitness, beauty and salon, e-commerce, travel, plus a generic pack. Category is detected from the scan or chosen by the owner.

## 9. Deferred

Social profile scraping (OAuth import is preferred), in-depth competitor research (crawling competitor sites and socials; one-time discovery of at least three competitors is built, ADR 0007), automatic rescans, Firecrawl or headless rendering, enterprise multi-brand and approval chains, reputation and review ingestion, document OCR.

## 10. Brief coverage

The brief's 12 categories map as: 1 `brand_profile`; 2 products and services tables; 3 `brand_audience`; 4 profile plus preferences; 5 goals in profile and preferences; 6 `brand_social_account`; 7 `brand_competitor` (one-time discovery plus owner edits, ADR 0007); 8 `memory_preference`; 9 policies, FAQs, profile attributes; 10 campaign records (M5); 11 reputation (deferred); 12 `attributes` JSONB plus category packs.

## 11. Implementation status (2026-11-13)

Built and verified end to end (API smoke suite, unit tests, and a real-browser run):

- **Auth** (`modules/identity`): register, login, refresh, logout, me. Argon2id passwords, 15-minute JWT access token held in memory, 30-day rotating refresh token in an httpOnly cookie scoped to `/v1/auth`. Refresh stores only an HMAC of the secret; a replayed rotated token revokes the session, with a 10 s grace window so two tabs refreshing together are not logged out. Cookie endpoints require `Origin` to equal `WEB_ORIGIN`. A global guard protects every route unless marked `@Public()`.
- **Tenancy**: `PrismaService.withTenant` runs each tenant transaction as the `app_runtime` role (NOBYPASSRLS) with `app.workspace_id` set. Verified: another workspace and an unset session see zero rows, and a cross-tenant insert is rejected. All tenant-table access must go through `withTenant`.
- **Onboarding** (`modules/onboarding`, `modules/brand`): `GET /onboarding`, `PUT /onboarding/steps/:step`, `POST /onboarding/complete`. Steps are `type`, `basics`, `about`, `goals`. Questions live once in `packages/contracts` (`QUESTIONS`) and drive both server validation and the web forms. Step saves are idempotent, ordered, and write verified `user_stated` provenance. Completion writes an `onboarding.completed` outbox event.
- **Web**: `/register`, `/login`, `/onboarding/[step]`, `/onboarding/done`; the workspace routes are gated on sign-in and completed onboarding.

Not built yet: phone-OTP sign-in, email verification and password reset, login rate limiting (needs Redis), role management and invites, the settings page for editing the profile.

Operational notes:

- The API needs `DATABASE_URL` (pooled) and `DIRECT_URL` (migrations). Auth needs no Redis; `/v1/health` does.
- With a folder schema, migrations live in `apps/api/prisma/schema/migrations/`. Prisma cannot model the generated `search_text` column or its GIN index, so `prisma migrate dev` will propose dropping that index. Remove that statement by hand from any generated migration, or use hand-written SQL and `migrate deploy`.
- `next build` and `next dev` share `.next`; building while a dev server runs corrupts both. Set `NEXT_DIST_DIR=.next-verify` for a verification build.

### Google sign-in (2026-11-13)

Server-side authorization code flow with PKCE, state and nonce; no new dependency (`jose` verifies the ID token against Google's JWKS).

- `GET /v1/auth/google/start` redirects to Google and sets a signed 10-minute `mp_oauth` cookie (state, PKCE verifier, nonce). `GET /v1/auth/google/callback` checks state, exchanges the code, verifies the ID token (issuer, audience, nonce, signature), signs the user in, sets the normal refresh cookie and redirects to web `/auth/callback`, which trades the cookie for an in-memory access token. Every failure redirects to `/login?google=<reason>`.
- Only `email_verified` Google accounts are accepted. A returning user is matched by `google_sub`, never by email. A first sign-in with an email that already has a password account links to it.
- **Takeover guard:** password sign-up does not verify email yet, so someone could pre-register a victim's address. When Google links to an account whose `email_verified_at` is null, that account's password is removed. Verified accounts keep theirs. A password-reset flow will let such users set a password again.
- New Google users get a user, workspace and owner membership, then go through onboarding as usual.
- Off until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; the button then redirects back with an "unavailable" message. Set `GOOGLE_REDIRECT_URI` to exactly what is registered in Google Cloud. Verified without real credentials: redirect URL and cookie, forged or missing state, denied consent, unconfigured, unit tests. The live Google round trip needs real credentials.

### Website scan and review (2026-11-13)

Implemented in `modules/memory/knowledge` (crawler behind `CrawlerPort`, ADR 0003; adds `cheerio@1.0.0`).

- **Flow:** `basics` -> `review` -> `about` -> `goals`. `review` applies only to a business with a website (`onboardingStepsFor`); the state's `steps` list drives progress and routing in the web app. The review page starts a scan (`POST /v1/onboarding/scan`), polls `GET /v1/onboarding/scan` every 1.5 s while it runs, then shows candidates grouped as profile fields, social profiles and products. The owner unticks, edits or skips; `PUT /onboarding/steps/review` applies the decisions. Changing the website in `basics` clears `review` so it is redone.
- **Crawler:** own HTTP client. SSRF guard: http(s) on 80/443 only, no credentials, no `localhost`/`.local`/`.internal`, literal IPs checked, and every resolved address checked at connect time (`lookup` hook) so DNS rebinding and redirects cannot reach private, loopback, link-local, metadata or CGNAT ranges. Caps: 4 redirects, 1.5 MB after decompression, 10 s per request, 60 s per scan, 10 pages. robots.txt per RFC 9309 (4xx = allow all, 5xx or unreachable = do not crawl). Page choice is the homepage's own links ranked by kind (about, contact, products, services, FAQ, policy), a few pages per kind, plus guessed `/about` and `/contact`.
- **Extraction is deterministic only:** JSON-LD (Organization, LocalBusiness, Store, Product, `sameAs`), meta tags, `mailto:`/`tel:` links, social links, Shopify `/products.json`, WooCommerce Store API. Trust is rule-based (platform API 0.95, JSON-LD 0.9, page link 0.8, meta tag 0.7). No LLM is involved, so page text can never act as an instruction. LLM gap-filling for JS-only or prose-only sites is the next step. Builder and network footer profiles (Wix, Shopify, Facebook itself) are filtered out.
- **Data:** each scan writes `website_scan`, one `knowledge_source`, a versioned `knowledge_document` per page (older versions marked superseded) and `knowledge_extraction` candidates. A rescan marks earlier unreviewed candidates `stale`. Approval is the only path to verified data: profile columns (with provenance `crawled`, or `user_stated` if the owner edited the value), `brand_social_account` (`url_only`), `brand_product` (upsert by external id or URL). The scan never proposes over a value the owner already stated.
- **Not built:** chunking and embeddings (needs the embedding model and a queue), FAQ, policy and service extraction, sitemap discovery, non-UTF-8 pages, JS-rendered sites (reported as "found few details"). The scan runs in the API process, not a queue; a scan lost to a restart is closed out as failed after 3 minutes. Move it to BullMQ when Redis is added.
- **Verified:** crawler unit tests (SSRF ranges including `127.1`, decimal and hex IPs, mapped IPv6; redirects, size and decompression caps; robots), scanner tests on fixtures, and a real-browser run on a live Shopify store (24 products with rupee prices, social profiles, logo, description) through sign-in, review, edits, rejection, prefilled About step and completion, plus the blocked-address path at 360 px and desktop.

### Brand profile page (2026-11-13)

The ongoing home for everything onboarding collects: `/brand` in the dashboard (sidebar item "Brand profile", a bottom bar on phones, and a completeness card on Home).

- **Field registry** (`packages/contracts/src/profile`): all 176 fields of the information checklist, numbered as in the brief and grouped into its 12 categories, plus a few additions (state, PIN code, WhatsApp link, creator niche and type) and nine category packs (fashion, restaurant, real estate, healthcare, education, fitness, beauty, e-commerce, travel) that appear only for the brand's category. It is the single source for API validation, storage mapping and the page. A test asserts every number 1 to 176 exists exactly once.
- **Where values live:** typed `brand_profile` columns for the stable core, the `attributes` JSON map for the long tail, `brand_social_account` rows for platform links, `brand_policy` rows for return, cancellation and warranty text, and `brand` for name, website, size and languages. Catalogue fields (names, categories, pricing, availability) are computed from `brand_product`. Fields that need a connected account (follower counts, engagement, Google ratings and similar) show as "needs a connected account" and are read-only until M6 and M9 land. Provenance (`crawled`, `user_stated`, ...) is shown per field.
- **API** (`modules/profile`, all under `/v1/brand`): `GET /profile` (sections, per-field value, status and source, completeness), `PUT /profile` (only changed fields; `null` clears; every problem reported per field; nothing is written if any value is invalid), `GET/PUT/DELETE /products(/:id)`, and `POST/GET /profile/scan` plus `POST /profile/scan/review` to re-read the website and approve what it finds with the same review list used in onboarding. Reading is open to every member; changing needs owner, admin or manager. Account type decides which fields apply, and a category chosen in the same save already unlocks its pack.
- **Rules worth knowing:** editing a value marks it `user_stated`; a social link field edits its first link in place and leaves other approved profiles alone; a product the owner edits becomes theirs; completeness excludes connection-only fields and the repeated "Brand name" row.
- **Not built:** structured services, FAQ, competitor and persona records (these are text fields for now), per-product details beyond the main fields, bulk import, field-level history, rate limiting on re-reading a website (needs Redis), and AI suggestions for the fields marked as AI-sourced.
- **Verified:** registry, read and write rules by unit tests; the API by 25 checks against the database (edit, clear, reject bad input, website re-read, review, product edit and delete); and the page by 25 real-browser checks including 360 px layouts and the mobile bottom navigation.

### Setup redesign (2026-11-26)

Screens follow the approved design in `docs/design/MarketPilot-onboarding-netlify/setup` (English only for now). The API steps are unchanged (`type`, `basics`, `review`, `about`, `goals`); the screens map onto them:

- `type`: business or creator. Agency is shown as "Coming soon" (no agency account type yet).
- `basics`: three screens in one step. Business: how customers buy (saved as profile `salesChannels`), then the link screen (name, city, website or social or Google Maps links), or a manual screen. Links are classified by `classifyLink` in contracts: a website is scanned; social links are saved as `social.<provider>` profile fields; Google Maps links stay in the onboarding answers until there is a field for them. `language` is now optional here so re-saving basics does not reset languages.
- `about` is the Voice screen: post languages (up to 3, sent as `postLanguages`, written as `brand.language` plus `brand.secondaryLanguages`), tone, words to avoid. "What you sell" and the category are asked here only when the website scan did not answer them.
- `goals`: main goal (adds `footfall`), customer reach (new question `customer_reach`, profile field 184 `customerReach`), channels, ad budget.
- Profile values from setup go through `BrandProfileService.update`, the same validated path as the Brand profile page.

Not built from the design: agency setup, reading Instagram or Google Maps pages, the logo and photo upload, the separate "Add products" screen, the Hindi switch, and Hinglish or Punjabi as post languages.

### AI suggestions and embeddings (2026-11-14)

OpenRouter behind `LlmPort` (ADR 0004; `infra/llm-providers`, reached only through `modules/ai`). Without `OPENROUTER_API_KEY` the AI steps are skipped and everything above still works.

- **Flow:** crawl -> deterministic candidates -> AI step -> candidates saved unapproved -> owner reviews. The scan has stages `reading`, `understanding`, `done`; the AI step never fails a scan (a failure is shown as one calm sentence and logged with its real reason).
- **What the AI may fill** (`AI_FIELD_MODES` in `packages/contracts/src/profile/ai-fields.ts`): about 55 text, list and choice fields that suit a written answer, plus the category pack of the brand's category. `stated` fields need a verbatim quote from the site; `inferred` ones (audience, tone, positioning, USP and similar) are labelled "Suggested by AI". Never asked: contact details, links, prices, numbers, budgets, goals, approvals, competitors. Fields the owner already filled, or the crawler already found, are skipped.
- **Request:** one strict-JSON-schema call per field group (identity, offering, audience), in parallel, built from the field registry with no union types. Evidence is capped (60,000 characters in total, 10,000 for the home page). Model: `anthropic/claude-haiku-5.5` (`OPENROUTER_MODEL_EXTRACT`). Every request sends `provider.zdr: true`, `data_collection: deny` and `require_parameters: true`; no owner name or email is ever sent.
- **Verification in code, never trust:** each answer passes the same rules as a manual edit; a "stated" value is dropped unless its quote is found in the pages sent; text that reads like an instruction to the system is dropped; an inference is dropped for a stated-only field. Page text is wrapped as data with angle brackets neutralised.
- **Approval:** stored as `knowledge_extraction` rows of kind `profile_field` (model and prompt version recorded). Approving writes through the same path as the profile editor, with provenance `crawled` (stated), `ai_inferred` (inferred) or `user_stated` (edited), shown on the profile as "From your website", "Suggested by AI" or "Added by you".
- **Embeddings:** after a scan, page text is split into sentence-aligned chunks (about 1,000 characters, small overlap, versioned with the page) and embedded with `openai/text-embedding-3-large` at `dimensions=1024` into `knowledge_embedding` (`halfvec(1024)`). Wrong-sized vectors are refused. Runs in the background and retries pending chunks on the next scan. Page text excludes `nav`, `header`, `footer` and `aside` (the footer is kept in the document's `metadata.footerText` and still shown to the AI step), so menus do not crowd every page's first chunk.
- **One write path:** `PUT /brand/profile` takes `values` (profile fields), `products` and `services` (entries to create, edit or remove) in one transaction. Products and services carry a `featured` flag ("most popular") in `attributes`. The old per-product `PUT`/`DELETE` endpoints are gone.
- **Structured memory is searchable too** (2026-11-16): after every profile or catalogue save and every approved review, `MemoryService.syncEntities` turns owner-verified records into chunks with `entity_type` and `entity_id` (`product`, `service`, `policy`, `faq`, `audience`, and `profile:<section>` for the 176-field profile). Unchanged records cost nothing; changed ones get a new version; removed ones stop being searchable and lose their vectors. Price and stock are kept out of the embedded text: they are read from the record.
- **Retrieval:** `MemoryService.retrieve(workspaceId, brandId, question, { limit, entityTypes })` runs vector and full-text search inside the tenant transaction and returns passages with their kind, title and URL. Ranking is cosine similarity plus a small boost for keyword coverage (rank fusion was tried and let loose keyword hits beat the real answer). Without the embedding model it falls back to keywords. No HTTP endpoint yet; the copilot and generators call it in-process.
- **Context for AI tasks:** `MemoryService.buildContext(workspaceId, brandId, { objective, budgetTokens })` returns one `<business_context>` block (default budget 2,500 tokens): about 20 confirmed core facts (tone, audience, USP, words to avoid...), then verified products and services with live price and stock (most popular first, at most 35% of the budget, "…and N more" when cut), then the most relevant passages with their source. It says "None recorded yet. Do not invent any." when the catalogue is empty, and neutralises angle brackets so business data cannot close or fake the block.
- **Usage:** tokens and the gateway-reported cost are stored in `website_scan.completeness.ai`. Run limits and credits are deliberately not enforced yet (M13).
- **Verified with a local fake gateway** (no real key used): the exact privacy and schema fields on every request, invented quotes and injected instructions refused, owner edits recorded as theirs, a rescan skipping approved fields, and 1024-dimension vectors written to the database. Not verified: a real OpenRouter call. First real run: set the key, check that a zero-retention provider exists for the chosen models (an HTTP 404 means none does), confirm `dimensions` is honoured for the embedding model, then tune prompts on a few real sites including Hindi and Hinglish ones.
