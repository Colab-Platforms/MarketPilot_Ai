# Business Brain Design

Status: approved design direction, schema not yet written. Version 1.0, 2026-11-12.

Business Brain is the multi-tenant, persistent business intelligence engine behind every AI feature. The scope document calls it "Brand Brain"; both names mean the same system. It is not a RAG chatbot. It accumulates, organises, updates and retrieves business knowledge for the whole lifetime of a customer, and gives each AI request only the context it needs.

Source: design brief supplied by the founder (originally written under the working name Scalio). Sections marked **Mapping** or **Adaptation** are our additions for this codebase. Everything else records the brief. Relationship to `ARCHITECTURE.md` section 4 is in section 14 below.

## 1. Engineering objectives

1. **Deep business understanding.** Accumulate, organise, update and retrieve knowledge for the customer's lifetime.
2. **Token and infrastructure optimisation.** Never resend the whole profile, conversation history or knowledge base. Each request gets only what its task needs.

Design principle: the Brain is **model-independent**. Changing the LLM provider must not touch stored knowledge. Changing the embedding model must be possible by regenerating embeddings from original knowledge, with no loss of memory. Memory updates make the system more knowledgeable about a business; they never change LLM weights.

## 2. Layered architecture

```
Knowledge ingestion   website, documents, images and video, conversations, campaign analytics, business inputs
        |
Processing            extraction, OCR, transcription, classification, deduplication, entity resolution
        |
Business Memory       structured | semantic | episodic | procedural-preference | media
        |
Retrieval and context intent detection, hybrid search, reranking, memory selection, context compression
        |
LLM gateway           model routing across providers
        |
Outputs               strategies, campaigns, creative ideas, recommendations, analysis
        |
Every eligible event feeds back into Business Memory
```

## 3. Logical services

Start as modules of the existing NestJS modular monolith with asynchronous workers. Extract crawling, media processing and embedding generation into separate services only when load demands it.

| Service | Responsibility |
|---|---|
| business-profile | Company profile and core information |
| knowledge-ingestion | Website, file and external data ingestion |
| document-processor | Parsing, OCR, transcription, extraction |
| knowledge-manager | Knowledge creation, update, deletion |
| memory-manager | Long-term memory, preferences, decisions |
| embedding-service | Generate and manage embeddings |
| retrieval-engine | Search and retrieve relevant knowledge |
| context-engine | Build optimised LLM context |
| llm-orchestrator | Model selection and AI execution |
| conversation-manager | Conversation and message history |
| asset-manager | Images, videos, generated assets |
| analytics-memory | Campaign outcomes and performance |
| memory-consolidator | Summarise, deduplicate, update memories |

**Adaptation (proposed placement, to avoid 13 new Nest modules for a 1-2 engineer team):**

| Services | Lives in |
|---|---|
| business-profile | `modules/brand` |
| knowledge-ingestion, document-processor, knowledge-manager, embedding-service | `modules/memory/knowledge` |
| memory-manager, memory-consolidator, analytics-memory | `modules/memory/memory` |
| retrieval-engine, context-engine | `modules/memory/retrieval` |
| llm-orchestrator | `modules/ai` |
| conversation-manager | `modules/agents` (copilot conversations) |
| asset-manager | `modules/assets` |

Everything outside `modules/memory` reaches the Brain only through `MemoryService` (CLAUDE.md rule 2).

## 4. Four memory systems

They solve different retrieval problems: looking up a price, recalling a past decision and following a preference are not the same search.

| Memory | Meaning | Storage | Notes |
|---|---|---|---|
| **Structured** | What is factually true | Relational tables in PostgreSQL | Authoritative. A current price comes from the product record, never from an old vector hit. Examples: brand name, industry, target market, primary channel, brand tone, products. |
| **Semantic** | What the business knows | PostgreSQL source records, pgvector embeddings, full-text index | Company info, products and services, positioning, target customers, competitors, channels, website content, uploaded documents. |
| **Episodic** | What happened over time | Event records | Owner approved a campaign, AI generated an idea, owner rejected a design, product launched, strategy revised. Gives historical context. |
| **Procedural / preference** | How the business wants things done | Preference records with confidence | "Use a professional tone", "avoid aggressive promotion", "prefer Instagram", "use approved colours", "never publish without owner approval". Influences future generations. |
| **Media** | Images, video, files | Object storage plus metadata | Originals in S3-compatible storage behind `StoragePort`. |

**Mapping to ARCHITECTURE.md layers:** Structured = L1 canonical profile (and products, campaign metrics). Semantic = L2 knowledge. Episodic = L3 episodic. Preferences = stated ones in L1, learned ones in L4 insights, both carrying confidence. See section 14.

## 5. Ingestion lifecycle

Every source, whatever its type, follows the same eight steps:

1. **Source registration.** Register the source against the tenant.
2. **Raw data storage.** Keep the original file, page snapshot or event payload with source and version.
3. **Content extraction.** Text, tables, metadata, OCR text, image descriptions, video transcripts.
4. **Normalisation.** Convert to a consistent internal format.
5. **Classification.** Business fact, product, preference, decision, campaign or other knowledge.
6. **Validation and deduplication.** Check existing knowledge, source reliability, conflicts, duplicates.
7. **Memory writing.** Update structured records, semantic chunks, episodic events, media metadata as appropriate.
8. **Embedding and indexing.** Generate embeddings and update indexes asynchronously.

### Website onboarding example

1. Discover sitemap and internal links.
2. Identify relevant pages.
3. Crawl product, about, service, pricing, contact pages.
4. Extract text, images, metadata, links.
5. Identify products, services, brand descriptions, contact details.
6. Detect duplicate content.
7. Save extracted information with its original URL.
8. Generate structured business information and searchable knowledge.
9. Show the owner a review screen to correct inaccurate information.

Crawling is **not one-time**: schedule incremental recrawls and change detection so outdated information is updated. Respect access restrictions, robots directives, rate limits and applicable terms; do not assume all content can be extracted.

### AI-generated content example

For "Generate 10 Instagram campaign ideas", save: the request, the generated ideas, model and prompt version, business context used, timestamps, owner feedback, approval or rejection. Do **not** turn the ideas into established facts. When the owner approves idea 3, create an approved decision memory and update the relevant campaign records.

## 6. Memory write policy

Every interaction or platform event produces a **candidate memory**. Only some candidates are promoted to long-term memory.

| Event | Memory action |
|---|---|
| Owner confirms a fact | Save as verified fact |
| Website contains business information | Save with source attribution |
| Owner changes product pricing | Update authoritative product record |
| Owner approves generated content | Save approval decision |
| Owner rejects generated content | Save rejection and reason |
| AI generates an idea | Save as generated artifact |
| Owner states a style preference | Save preference, subject to confidence |
| Campaign performance becomes available | Save measured performance |
| Owner asks a temporary question | Keep in conversation history, usually not permanent memory |

Each memory record carries: type, content, `source_type`, `confidence`, `status` (for example candidate or verified), created and updated timestamps.

Rules:
- **Confidence comes from evidence and source quality, never from the LLM's self-assessment.**
- Memory versioning.
- Conflict resolution. Example: the website says 999 rupees, the owner confirms 1,299: the newer verified owner update wins.
- Expiration and freshness rules.
- User corrections override and are recorded.
- Source traceability on every record.
- Deletion propagates to chunks, embeddings, summaries and caches, followed by re-indexing.

## 7. Retrieval engine

Hybrid retrieval, never vector search alone (vectors return similar-but-outdated information). Combine:
- Vector similarity search
- PostgreSQL full-text (keyword, BM25-style) search
- Structured SQL queries
- Metadata filtering
- Reranking

Worked example, "Create a marketing strategy for our premium collection based on previous campaign performance":

| Operation | Retrieves |
|---|---|
| Intent detection | Marketing strategy |
| Structured query | Premium collection products |
| Vector search | Relevant brand and audience knowledge |
| Episodic search | Previous campaign decisions |
| Performance search | Actual campaign metrics |
| Preference retrieval | Brand tone and restrictions |
| Reranking | Select the most relevant evidence |
| Context assembly | Build a compact business context |

The assembled context is short and structured: brand, relevant identity, relevant products with current prices, target audience, previous campaign result, approved preferences, user objective. It goes to the LLM with the task instructions. No thousands of conversations or hundreds of pages.

**Retrieval budget per task.** A simple product description may need 1-3 structured records, 2-3 knowledge chunks and the brand preferences. A strategy may need profile, products, audience insights, campaign history, metrics and strategic decisions. Budgets are illustrative starting points, adapted by task complexity and model limits.

## 8. Token optimisation

Six mechanisms:

| Mechanism | Purpose |
|---|---|
| RAG | Avoid sending irrelevant knowledge |
| Memory summarisation | Reduce repetitive historical context |
| Semantic caching | Reuse eligible previous results |
| Prompt caching | Reuse provider-side prompt prefixes where supported |
| Model routing | Cheaper models for simpler tasks |
| Context compression | Remove redundant retrieved information |

Semantic cache is not memory. Memory stores business knowledge; a cache stores reusable computation results. Cached brand positioning may be reused; today's campaign performance must always be fetched fresh. Cache keys and eligibility must account for: tenant ID, user permissions, relevant memory versions, model, prompt version and data freshness.

### Request lifecycle

```
Request
  -> authentication and tenant validation
  -> intent classification
  -> task complexity detection
  -> memory retrieval
  -> context compression
  -> model selection
  -> LLM gateway
  -> response generation
  -> save conversation and artifact
  -> memory write evaluation
  -> business memory update
```

## 9. Database design

PostgreSQL is the primary source of truth. Proposed entity tree:

```
Business (tenant)
 |- BusinessProfile, BusinessMember
 |- KnowledgeSource -> KnowledgeDocument, KnowledgeChunk, KnowledgeExtraction
 |- BusinessMemory  -> MemoryFact, MemoryPreference, MemoryDecision, MemoryVersion
 |- Conversation    -> Message
 |- GeneratedArtifact -> GeneratedImage, GeneratedVideo, GeneratedDocument
 |- Campaign        -> CampaignEvent, CampaignMetric
 |- MemoryEvent     -> MemoryJob, MemoryAuditLog
```

Design decisions:
1. **Keep original knowledge separate from extracted knowledge.** KnowledgeSource is the original URL or file; KnowledgeExtraction is extracted text and structured results; KnowledgeChunk is searchable content; BusinessMemory is distilled facts and preferences. Originals can be reprocessed when extraction improves.
2. **Keep embeddings separate from business facts.** An embedding is a search representation, not truth. Store original content, embedding model, dimensions, chunk version, source reference and indexing status in their own table, with a foreign key to the chunk, a uniqueness constraint per model and version, and a vector similarity index.
3. **Event-driven updates.** For example `PRODUCT_UPDATED` triggers updates of the search representation, memory summaries and caches. Use a **transactional outbox** so a commit and its event cannot drift apart.

Illustrative embedding table (dimension fixed at 1024 by ADR 0002; `halfvec` per ARCHITECTURE.md 3.1):

```sql
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL,
  chunk_id UUID NOT NULL,
  embedding_model VARCHAR(100) NOT NULL,
  embedding_version VARCHAR(50),
  embedding HALFVEC(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_knowledge_embeddings_business ON knowledge_embeddings(business_id);
```

**Adaptation:** `business_id` in the brief corresponds to `brand_id` here, with `workspace_id` on every row as well (ARCHITECTURE.md section 3).

## 10. Technology choices

| Need | Choice |
|---|---|
| Facts, structure, chunks, vectors | PostgreSQL + pgvector |
| Queues, retries, caching | Redis + BullMQ |
| Originals and generated media | S3-compatible storage (R2 or S3) behind `StoragePort` |
| LLM access | Multi-provider gateway |
| LLM tracing, cost, evaluation | Langfuse |

Use a dedicated vector database such as Qdrant only when search workload, indexing needs or scale justify the extra infrastructure. Retrieval stays behind `MemoryStore` so this is a swap, not a rewrite.

## 11. Security and multi-tenancy (non-negotiable)

1. Every knowledge, memory and asset record belongs to a tenant.
2. Tenant identity comes from authenticated server-side authorisation, never from a user-supplied retrieval filter.
3. Apply tenant filters inside vector search, before results are returned.
4. Row-level security as defence in depth next to application authorisation.
5. Encrypt sensitive data at rest and in transit.
6. Provider API keys in a secrets manager.
7. Audit-log access, changes, memory creation and deletion.
8. Deletion propagates to embeddings, summaries, caches and generated indexes.
9. Retention policies for conversation and media data.
10. One business's private information never trains or improves another's memory.

Data sent to an external LLM provider leaves our infrastructure: provider retention, training, logging and data-processing terms must be evaluated per model and per customer data category.

## 12. Quality measures

Do not measure success by how much is stored.

| Metric | Question answered |
|---|---|
| Retrieval precision | Is relevant information retrieved? |
| Retrieval recall | Are important items missed? |
| Answer groundedness | Are responses supported by business evidence? |
| Knowledge freshness | Is outdated information used? |
| Memory write accuracy | Are correct facts saved? |
| Token consumption | How much context does each task use? |
| Cost per task | What does each AI operation cost? |
| Cross-tenant leakage | Are tenant boundaries respected? (must be zero) |
| Ingestion success rate | Is incoming information processed correctly? |

Keep a test dataset of business questions with expected answers and supporting sources. Re-run it whenever the embedding model, chunking strategy, retrieval logic or prompt templates change.

## 13. Build order

Do not code the crawler or vector search before the database and knowledge lifecycle are final.

| Phase | Contents |
|---|---|
| 1. Business foundation | Onboarding and profile, database schema, tenant isolation, website crawling, document upload and extraction, structured business knowledge |
| 2. Knowledge engine | Chunking and metadata, embeddings, pgvector, hybrid search, source attribution, knowledge update and deletion |
| 3. Memory engine | Facts and preferences, decision memory, conversation memory, generated-artifact tracking, write policy, consolidation |
| 4. Intelligent retrieval | Intent classification, task complexity detection, hybrid retrieval, reranking, context compression, context budgeting |
| 5. AI orchestration | Provider integration, model routing, token tracking, semantic caching, prompt caching, observability and evaluations |
| 6. Continuous learning | Event-driven memory updates, media understanding, campaign analytics integration, memory quality evaluation, automatic knowledge refresh, Business Brain dashboard |

Freeze the architecture in this order: (1) complete database schema, (2) ingestion architecture, (3) memory engine, (4) embeddings and vector search, (5) RAG retrieval, (6) context optimisation, (7) LLM integration.

**Next step:** the complete production-grade Prisma schema covering all entities and relationships, tenant isolation, source and document versioning, chunking and embedding management, the memory types, conversations and generated assets, memory events and jobs, indexes, constraints and deletion policies. Then the NestJS module structure.

## 14. Reconciliation with ARCHITECTURE.md section 4 (our additions)

The earlier four-layer design and this brief agree on the essentials: provenance and trust, candidates before promotion, hybrid retrieval, tenant filtering, deletion propagation, replaceable stores. Where this document is more specific, **this document wins**:

| Topic | Earlier text | Now |
|---|---|---|
| Layer names | L1 profile, L2 knowledge, L3 episodic, L4 insights | Structured, semantic, episodic, procedural-preference (plus media); L1-L4 map onto them (section 4) |
| Embeddings | Column on `memory_chunk` | Separate embeddings table with model and version; reprocessable from originals |
| Raw data | Not specified | Source, document, extraction, chunk are distinct, versioned records |
| Write policy | Trust order and candidates | Adds statuses, evidence-based confidence, versioning, expiry, event-to-action table (section 6) |
| Retrieval | Context builder with token budget | Adds intent and complexity detection, reranking, compression, per-task budgets |
| Caching | Exact and later semantic cache | Defined cache-key and eligibility rules (section 8) |

Phase mapping to the lean roadmap (ARCHITECTURE.md section 12): phases 1-2 and the core of 3 and 4 belong to roadmap Stage 1. Phase 5 basics (routing, token tracking, Langfuse) arrive with the AI gateway in Stage 1; semantic caching, media understanding, the dashboard and automatic refresh come in Stages 2-3 or later.

## 15. Onboarding additions (2026-11-13, owner-approved)

The owner approved this document's entity tree as the memory data model and approved these additions. Details are in `docs/ONBOARDING.md`.

- New tables beside the tree: `brand_profile` (typed core plus per-category `attributes` JSONB), `onboarding_session`, `website_scan`, and entity tables `brand_product`, `brand_service`, `brand_policy`, `brand_faq`, `brand_audience`, `brand_competitor`, `brand_social_account`.
- Extraction output is a candidate (`knowledge_extraction`); only owner review promotes it to a verified entity or profile row, which then queues chunking and embedding. This is the section 6 write policy applied to onboarding.
- `source_trust` is a rule-based score (source type and method). It replaces any LLM-reported confidence, in line with section 6.
- Embedding dimension is 1024 (ADR 0002); the database is Neon Singapore (ADR 0001); the crawler is our own, behind `CrawlerPort` (ADR 0003).

Constraints that still apply from CLAUDE.md: no new infrastructure or heavy dependency without an ADR (Qdrant, a reranking service and any new queue stay deferred), and any change to the memory data model is asked about before it is made.
