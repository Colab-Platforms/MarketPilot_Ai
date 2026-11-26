-- CreateEnum
CREATE TYPE "GenerationKind" AS ENUM ('image');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "studio_generation" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "kind" "GenerationKind" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL,
    "product_id" UUID,
    "product_name" TEXT,
    "requested" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT,
    "prompt_version" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION,
    "error_code" TEXT,
    "message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_output" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "generation_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "model" TEXT NOT NULL,
    "cost_usd" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_output_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_generation_brand_id_kind_created_at_idx" ON "studio_generation"("brand_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "studio_generation_workspace_id_status_idx" ON "studio_generation"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "studio_generation_id_workspace_id_key" ON "studio_generation"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "studio_generation_workspace_id_idempotency_key_key" ON "studio_generation"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "studio_output_generation_id_idx" ON "studio_output"("generation_id");

-- CreateIndex
CREATE INDEX "studio_output_workspace_id_created_at_idx" ON "studio_output"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "studio_generation" ADD CONSTRAINT "studio_generation_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_output" ADD CONSTRAINT "studio_output_generation_id_workspace_id_fkey" FOREIGN KEY ("generation_id", "workspace_id") REFERENCES "studio_generation"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['studio_generation', 'studio_output']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      tenant_table
    );
  END LOOP;
END $$;
