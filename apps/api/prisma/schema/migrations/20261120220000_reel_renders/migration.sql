-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "reel_render_id" UUID;

-- CreateTable
CREATE TABLE "reel_render" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "inputs" JSONB NOT NULL,
    "inputs_hash" TEXT NOT NULL,
    "status" "ReelTakeStatus" NOT NULL DEFAULT 'queued',
    "url" TEXT,
    "duration_seconds" DOUBLE PRECISION,
    "asset_id" UUID,
    "message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_until" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_render_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reel_render_project_id_created_at_idx" ON "reel_render"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "reel_render_status_lease_until_idx" ON "reel_render"("status", "lease_until");

-- CreateIndex
CREATE UNIQUE INDEX "asset_reel_render_id_key" ON "asset"("reel_render_id");

-- AddForeignKey
ALTER TABLE "reel_render" ADD CONSTRAINT "reel_render_project_id_workspace_id_fkey" FOREIGN KEY ("project_id", "workspace_id") REFERENCES "reel_project"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
ALTER TABLE "reel_render" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reel_render" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reel_render"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
