# ADR 0002: Embedding vectors are halfvec(1024); model behind LlmPort

Status: accepted, 2026-11-13. Supersedes the `halfvec(1536)` example in ARCHITECTURE.md 3.1.

## Context
The vector dimension is baked into the schema and the HNSW index, so it must be fixed before the first migration, while the best Hindi and Hinglish model is still unproven.

## Decision
- Store embeddings as `halfvec(1024)` in `knowledge_embedding` (and later episodes). 1024 is native for Cohere multilingual and BGE-M3, and available by Matryoshka truncation for OpenAI `text-embedding-3-large` and similar models. Any of them fits without a migration.
- Default model for development: OpenAI `text-embedding-3-large` at `dimensions=1024`, called through `LlmPort.embed`. Challengers in the benchmark: Cohere multilingual embeddings and self-hosted BGE-M3.
- Before the first production index, run a one-day benchmark: about 100 Hindi, Hinglish and English brand queries with known relevant chunks, scored by recall@5. Pick the winner by recall, then cost. A different winner with 1024 dimensions changes nothing in the schema.
- Every row stores `embedding_model` and `embedding_version`. A model change builds a new index and swaps (ARCHITECTURE.md 4.3).
- Normalise vectors; use cosine distance.

## Consequences
- Switching to a model that cannot produce 1024 dimensions needs a new column and index, handled by the expand-and-contract migration rule.
- Provider terms for retention and training on customer text must be checked before enabling in production (BUSINESS_BRAIN section 11).
