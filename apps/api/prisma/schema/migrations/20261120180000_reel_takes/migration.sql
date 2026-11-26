-- CreateEnum
CREATE TYPE "ReelTakeKind" AS ENUM ('portrait', 'keyframe');

-- CreateEnum
CREATE TYPE "ReelTakeStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "reel_project" ADD COLUMN     "product_image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "reel_take" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "kind" "ReelTakeKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "inputs_hash" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReelTakeStatus" NOT NULL DEFAULT 'queued',
    "url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "model" TEXT,
    "prompt" TEXT,
    "prompt_version" TEXT,
    "cost_usd" DOUBLE PRECISION,
    "error_code" TEXT,
    "message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_take_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reel_take_project_id_kind_subject_created_at_idx" ON "reel_take"("project_id", "kind", "subject", "created_at");

-- CreateIndex
CREATE INDEX "reel_take_workspace_id_kind_created_at_idx" ON "reel_take"("workspace_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "reel_take_workspace_id_status_idx" ON "reel_take"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "reel_take" ADD CONSTRAINT "reel_take_project_id_workspace_id_fkey" FOREIGN KEY ("project_id", "workspace_id") REFERENCES "reel_project"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
ALTER TABLE "reel_take" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reel_take" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reel_take"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
