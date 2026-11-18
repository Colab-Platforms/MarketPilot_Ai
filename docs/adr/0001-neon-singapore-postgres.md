# ADR 0001: Neon Postgres in Singapore (ap-southeast-1)

Status: accepted, 2026-11-13.

## Context
Data residency was undecided. The founder chose Neon in AWS Singapore. pgvector is available on Neon, which keeps relational data and vectors in one database (ARCHITECTURE.md 4.5).

## Decision
- Primary database: Neon Postgres 16+, region `aws-ap-southeast-1`. Production, staging and CI use separate Neon branches or projects; CI uses short-lived branches for cross-tenant tests.
- Two connection strings: pooled (`-pooler`) as `DATABASE_URL` for the app and workers, direct as `DIRECT_URL` for Prisma Migrate. `schema.prisma` datasource adds `directUrl = env("DIRECT_URL")`.
- If Prisma rejects `channel_binding=require` in the pooled string, drop that parameter and keep `sslmode=require`.
- Extension `vector` is created by a migration.
- Use Neon only as Postgres. Its bundled Auth, Storage, AI Gateway and Data API are not adopted (one door for auth, `StoragePort`, `modules/ai`).
- Credentials live in the environment or secret manager only. Rotate any that were ever shown in a screenshot or chat.

## Consequences
- Data sits outside India. DPDP Act permits cross-border transfer except to countries the government restricts; confirm with counsel and state the region in the privacy policy before public launch. Enterprise customers who demand India residency need a second region; the repository and `StoragePort` abstractions keep that possible.
- Scale-to-zero adds cold-start latency; keep production compute always-on once there are paying users.
- Compute and storage limits bound HNSW build time; revisit at the thresholds in ARCHITECTURE.md 4.5.
