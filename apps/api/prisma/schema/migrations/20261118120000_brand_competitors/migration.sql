-- CreateEnum
CREATE TYPE "CompetitorDiscoveryStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "brand_competitor" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT,
    "domain" TEXT,
    "logo_url" TEXT,
    "summary" TEXT,
    "why_similar" TEXT,
    "offerings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_range" TEXT,
    "positioning" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "source_type" "SourceType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'candidate',
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_discovery" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "status" "CompetitorDiscoveryStatus" NOT NULL DEFAULT 'running',
    "found" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "model" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "competitor_discovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_competitor_brand_id_status_idx" ON "brand_competitor"("brand_id", "status");

-- CreateIndex
CREATE INDEX "brand_competitor_workspace_id_idx" ON "brand_competitor"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_competitor_brand_id_domain_key" ON "brand_competitor"("brand_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_discovery_workspace_id_key" ON "competitor_discovery"("workspace_id");

-- AddForeignKey
ALTER TABLE "brand_competitor" ADD CONSTRAINT "brand_competitor_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_discovery" ADD CONSTRAINT "competitor_discovery_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['brand_competitor', 'competitor_discovery']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      tenant_table
    );
  END LOOP;
END $$;
