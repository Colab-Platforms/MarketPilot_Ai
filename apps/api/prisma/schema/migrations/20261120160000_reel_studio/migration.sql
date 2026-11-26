-- CreateEnum
CREATE TYPE "ReelStatus" AS ENUM ('ideating', 'ideas_ready', 'storyboarding', 'storyboard_ready');

-- CreateTable
CREATE TABLE "reel_project" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "last_action_key" TEXT,
    "status" "ReelStatus" NOT NULL DEFAULT 'ideating',
    "brief" JSONB NOT NULL,
    "product_id" UUID,
    "product_name" TEXT NOT NULL,
    "chosen_idea_id" UUID,
    "cast" JSONB NOT NULL DEFAULT '[]',
    "message" TEXT,
    "step_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reel_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reel_idea" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "batch" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reel_scene" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reel_scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_digest" (
    "id" UUID NOT NULL,
    "topic_key" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trend_digest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reel_project_brand_id_created_at_idx" ON "reel_project"("brand_id", "created_at");

-- CreateIndex
CREATE INDEX "reel_project_workspace_id_status_idx" ON "reel_project"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reel_project_id_workspace_id_key" ON "reel_project"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "reel_project_workspace_id_idempotency_key_key" ON "reel_project"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "reel_idea_project_id_batch_position_idx" ON "reel_idea"("project_id", "batch", "position");

-- CreateIndex
CREATE INDEX "reel_scene_project_id_position_idx" ON "reel_scene"("project_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "trend_digest_topic_key_key" ON "trend_digest"("topic_key");

-- AddForeignKey
ALTER TABLE "reel_project" ADD CONSTRAINT "reel_project_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_idea" ADD CONSTRAINT "reel_idea_project_id_workspace_id_fkey" FOREIGN KEY ("project_id", "workspace_id") REFERENCES "reel_project"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_scene" ADD CONSTRAINT "reel_scene_project_id_workspace_id_fkey" FOREIGN KEY ("project_id", "workspace_id") REFERENCES "reel_project"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
-- trend_digest holds only public market trends shared by all workspaces, so it has no policy.
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['reel_project', 'reel_idea', 'reel_scene']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      tenant_table
    );
  END LOOP;
END $$;
