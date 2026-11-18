-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('user_stated', 'crawled', 'integration', 'ai_inferred');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('candidate', 'verified', 'rejected', 'stale');

-- CreateEnum
CREATE TYPE "BrandScale" AS ENUM ('solo', 'small', 'mid', 'enterprise');

-- CreateEnum
CREATE TYPE "OperatingModel" AS ENUM ('b2b', 'b2c', 'd2c', 'marketplace', 'mixed');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('in_stock', 'out_of_stock', 'preorder', 'unknown');

-- CreateEnum
CREATE TYPE "PolicyKind" AS ENUM ('return_policy', 'refund', 'shipping', 'cancellation', 'warranty', 'privacy', 'terms', 'other');

-- CreateEnum
CREATE TYPE "AudienceKind" AS ENUM ('primary', 'secondary', 'persona');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('instagram', 'facebook', 'whatsapp', 'youtube', 'linkedin', 'tiktok', 'pinterest', 'x');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('url_only', 'connected', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'manager', 'creator', 'approver', 'analyst', 'client');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('creator', 'business');

-- CreateEnum
CREATE TYPE "KnowledgeSourceKind" AS ENUM ('website', 'document', 'manual', 'social', 'integration');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('home', 'about', 'product', 'service', 'contact', 'policy', 'faq', 'blog', 'other');

-- CreateEnum
CREATE TYPE "ExtractionKind" AS ENUM ('business_profile', 'brand_identity', 'product', 'service', 'policy', 'faq', 'audience', 'social_link');

-- CreateEnum
CREATE TYPE "VersionState" AS ENUM ('active', 'superseded', 'deleted');

-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('pending', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('in_progress', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "brand" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website_url" TEXT,
    "scale" "BrandScale" NOT NULL DEFAULT 'small',
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profile" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "legal_name" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "category_pack" TEXT,
    "description" TEXT,
    "tagline" TEXT,
    "year_established" INTEGER,
    "employee_range" TEXT,
    "operating_model" "OperatingModel",
    "country" TEXT NOT NULL DEFAULT 'IN',
    "state" TEXT,
    "city" TEXT,
    "address_line" TEXT,
    "postal_code" TEXT,
    "service_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "branches" JSONB NOT NULL DEFAULT '[]',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "operating_hours" JSONB,
    "logo_url" TEXT,
    "primary_colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secondary_colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fonts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mission" TEXT,
    "vision" TEXT,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personality" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "positioning" TEXT,
    "story" TEXT,
    "tone_of_voice" TEXT,
    "words_to_use" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "words_to_avoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics_to_avoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primary_objective" TEXT,
    "secondary_objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "monthly_budget_minor" INTEGER,
    "budget_currency" TEXT NOT NULL DEFAULT 'INR',
    "preferred_channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "niche" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_product" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "external_id" TEXT,
    "canonical_url" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sku" TEXT,
    "price_minor" INTEGER,
    "compare_at_minor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "availability" "Availability" NOT NULL DEFAULT 'unknown',
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variants" JSONB NOT NULL DEFAULT '[]',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "content_hash" TEXT,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_service" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "canonical_url" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_minor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "duration_minutes" INTEGER,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "booking_process" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "content_hash" TEXT,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_policy" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "kind" "PolicyKind" NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "content_hash" TEXT,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_faq" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "content_hash" TEXT,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_audience" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "kind" "AudienceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "age_range" TEXT,
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pain_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "content_hash" TEXT,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_social_account" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "profile_url" TEXT NOT NULL,
    "handle" TEXT,
    "connection" "SocialConnectionStatus" NOT NULL DEFAULT 'url_only',
    "external_id" TEXT,
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_social_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'active',
    "account_type" "AccountType" NOT NULL DEFAULT 'business',
    "autonomy_level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "brand_scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_source" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "kind" "KnowledgeSourceKind" NOT NULL,
    "uri" TEXT NOT NULL,
    "label" TEXT,
    "last_fetched_at" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_document" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "scan_id" UUID,
    "url" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "page_type" "PageType" NOT NULL DEFAULT 'other',
    "title" TEXT,
    "language" TEXT,
    "http_status" INTEGER,
    "content" TEXT NOT NULL DEFAULT '',
    "content_hash" TEXT NOT NULL,
    "raw_storage_key" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "VersionState" NOT NULL DEFAULT 'active',
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_extraction" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "kind" "ExtractionKind" NOT NULL,
    "method" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_extraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunk" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "document_id" UUID,
    "entity_type" TEXT,
    "entity_id" UUID,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "language" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "VersionState" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_embedding" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "embedding_version" TEXT NOT NULL,
    "status" "EmbeddingStatus" NOT NULL DEFAULT 'pending',
    "embedding" halfvec(1024),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_fact" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "superseded_by_id" UUID,
    "expires_at" TIMESTAMP(3),
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "extraction_id" UUID,
    "extracted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_preference" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),
    "source_type" "SourceType" NOT NULL,
    "source_trust" REAL NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_session" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "track" "AccountType" NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'in_progress',
    "current_step" TEXT NOT NULL,
    "completed_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answers" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_scan" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "source_id" UUID,
    "requested_url" TEXT NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "platform" TEXT,
    "status" "ScanStatus" NOT NULL DEFAULT 'queued',
    "idempotency_key" TEXT NOT NULL,
    "pages_discovered" INTEGER NOT NULL DEFAULT 0,
    "pages_fetched" INTEGER NOT NULL DEFAULT 0,
    "pages_failed" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "completeness" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_scan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_workspace_id_idx" ON "brand"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_id_workspace_id_key" ON "brand"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profile_brand_id_key" ON "brand_profile"("brand_id");

-- CreateIndex
CREATE INDEX "brand_profile_workspace_id_idx" ON "brand_profile"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profile_brand_id_workspace_id_key" ON "brand_profile"("brand_id", "workspace_id");

-- CreateIndex
CREATE INDEX "brand_product_brand_id_status_idx" ON "brand_product"("brand_id", "status");

-- CreateIndex
CREATE INDEX "brand_product_brand_id_canonical_url_idx" ON "brand_product"("brand_id", "canonical_url");

-- CreateIndex
CREATE INDEX "brand_product_workspace_id_idx" ON "brand_product"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_product_brand_id_external_id_key" ON "brand_product"("brand_id", "external_id");

-- CreateIndex
CREATE INDEX "brand_service_brand_id_status_idx" ON "brand_service"("brand_id", "status");

-- CreateIndex
CREATE INDEX "brand_service_workspace_id_idx" ON "brand_service"("workspace_id");

-- CreateIndex
CREATE INDEX "brand_policy_brand_id_kind_idx" ON "brand_policy"("brand_id", "kind");

-- CreateIndex
CREATE INDEX "brand_policy_workspace_id_idx" ON "brand_policy"("workspace_id");

-- CreateIndex
CREATE INDEX "brand_faq_brand_id_status_idx" ON "brand_faq"("brand_id", "status");

-- CreateIndex
CREATE INDEX "brand_faq_workspace_id_idx" ON "brand_faq"("workspace_id");

-- CreateIndex
CREATE INDEX "brand_audience_brand_id_kind_status_idx" ON "brand_audience"("brand_id", "kind", "status");

-- CreateIndex
CREATE INDEX "brand_audience_workspace_id_idx" ON "brand_audience"("workspace_id");

-- CreateIndex
CREATE INDEX "brand_social_account_workspace_id_idx" ON "brand_social_account"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_social_account_brand_id_provider_profile_url_key" ON "brand_social_account"("brand_id", "provider", "profile_url");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- CreateIndex
CREATE INDEX "membership_user_id_idx" ON "membership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_workspace_id_user_id_key" ON "membership"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "knowledge_source_workspace_id_idx" ON "knowledge_source"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_source_brand_id_kind_uri_key" ON "knowledge_source"("brand_id", "kind", "uri");

-- CreateIndex
CREATE INDEX "knowledge_document_brand_id_state_idx" ON "knowledge_document"("brand_id", "state");

-- CreateIndex
CREATE INDEX "knowledge_document_content_hash_idx" ON "knowledge_document"("content_hash");

-- CreateIndex
CREATE INDEX "knowledge_document_workspace_id_idx" ON "knowledge_document"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_source_id_canonical_url_version_key" ON "knowledge_document"("source_id", "canonical_url", "version");

-- CreateIndex
CREATE INDEX "knowledge_extraction_brand_id_kind_status_idx" ON "knowledge_extraction"("brand_id", "kind", "status");

-- CreateIndex
CREATE INDEX "knowledge_extraction_document_id_idx" ON "knowledge_extraction"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_extraction_workspace_id_idx" ON "knowledge_extraction"("workspace_id");

-- CreateIndex
CREATE INDEX "knowledge_chunk_brand_id_state_idx" ON "knowledge_chunk"("brand_id", "state");

-- CreateIndex
CREATE INDEX "knowledge_chunk_document_id_ordinal_idx" ON "knowledge_chunk"("document_id", "ordinal");

-- CreateIndex
CREATE INDEX "knowledge_chunk_entity_type_entity_id_idx" ON "knowledge_chunk"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "knowledge_chunk_workspace_id_idx" ON "knowledge_chunk"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunk_brand_id_content_hash_version_key" ON "knowledge_chunk"("brand_id", "content_hash", "version");

-- CreateIndex
CREATE INDEX "knowledge_embedding_brand_id_status_idx" ON "knowledge_embedding"("brand_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_embedding_workspace_id_idx" ON "knowledge_embedding"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_embedding_chunk_id_embedding_model_embedding_vers_key" ON "knowledge_embedding"("chunk_id", "embedding_model", "embedding_version");

-- CreateIndex
CREATE INDEX "memory_fact_brand_id_category_status_idx" ON "memory_fact"("brand_id", "category", "status");

-- CreateIndex
CREATE INDEX "memory_fact_workspace_id_idx" ON "memory_fact"("workspace_id");

-- CreateIndex
CREATE INDEX "memory_preference_workspace_id_idx" ON "memory_preference"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_preference_brand_id_key_key" ON "memory_preference"("brand_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_idempotency_key_key" ON "outbox_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_event_status_available_at_idx" ON "outbox_event"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_event_workspace_id_idx" ON "outbox_event"("workspace_id");

-- CreateIndex
CREATE INDEX "onboarding_session_brand_id_status_idx" ON "onboarding_session"("brand_id", "status");

-- CreateIndex
CREATE INDEX "onboarding_session_workspace_id_idx" ON "onboarding_session"("workspace_id");

-- CreateIndex
CREATE INDEX "website_scan_brand_id_created_at_idx" ON "website_scan"("brand_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "website_scan_workspace_id_idx" ON "website_scan"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_scan_brand_id_idempotency_key_key" ON "website_scan"("brand_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "brand" ADD CONSTRAINT "brand_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_product" ADD CONSTRAINT "brand_product_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_service" ADD CONSTRAINT "brand_service_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_policy" ADD CONSTRAINT "brand_policy_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_faq" ADD CONSTRAINT "brand_faq_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_audience" ADD CONSTRAINT "brand_audience_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_social_account" ADD CONSTRAINT "brand_social_account_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_source" ADD CONSTRAINT "knowledge_source_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "website_scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_extraction" ADD CONSTRAINT "knowledge_extraction_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_extraction" ADD CONSTRAINT "knowledge_extraction_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunk" ADD CONSTRAINT "knowledge_chunk_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunk" ADD CONSTRAINT "knowledge_chunk_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunk" ADD CONSTRAINT "knowledge_chunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_embedding" ADD CONSTRAINT "knowledge_embedding_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_embedding" ADD CONSTRAINT "knowledge_embedding_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_fact" ADD CONSTRAINT "memory_fact_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_preference" ADD CONSTRAINT "memory_preference_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_session" ADD CONSTRAINT "onboarding_session_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_scan" ADD CONSTRAINT "website_scan_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_scan" ADD CONSTRAINT "website_scan_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written: search indexes Prisma cannot express.
-- 'simple' text config: no stemmer, so Hindi, Hinglish and English tokenise the same way.
CREATE INDEX "knowledge_chunk_search_text_idx" ON "knowledge_chunk" USING GIN ("search_text");

-- Cosine distance over normalised halfvec embeddings (ADR 0002). Only ready rows are indexed.
CREATE INDEX "knowledge_embedding_hnsw_idx" ON "knowledge_embedding"
  USING hnsw ("embedding" halfvec_cosine_ops) WITH (m = 16, ef_construction = 64)
  WHERE "status" = 'ready';

-- Hand-written: row-level security (defence in depth behind application authorisation).
-- Requests run in a transaction that executes
--   SELECT set_config('app.workspace_id', '<uuid>', true)
-- A missing setting yields NULL, so unset sessions see no rows.
-- FORCE applies the policy to the table owner too; the runtime role must also lack BYPASSRLS.
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'brand', 'brand_profile', 'onboarding_session', 'website_scan',
    'knowledge_source', 'knowledge_document', 'knowledge_extraction',
    'knowledge_chunk', 'knowledge_embedding',
    'brand_product', 'brand_service', 'brand_policy', 'brand_faq',
    'brand_audience', 'brand_social_account',
    'memory_fact', 'memory_preference', 'outbox_event'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      tenant_table
    );
  END LOOP;
END $$;
