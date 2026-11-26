-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('like', 'dislike');

-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "style_reference_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "studio_generation" ADD COLUMN     "style_reference_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "asset_feedback" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_feedback_workspace_id_rating_updated_at_idx" ON "asset_feedback"("workspace_id", "rating", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_feedback_asset_id_user_id_key" ON "asset_feedback"("asset_id", "user_id");

-- CreateIndex
CREATE INDEX "asset_brand_id_style_reference_at_idx" ON "asset"("brand_id", "style_reference_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_id_workspace_id_key" ON "asset"("id", "workspace_id");

-- AddForeignKey
ALTER TABLE "asset_feedback" ADD CONSTRAINT "asset_feedback_asset_id_workspace_id_fkey" FOREIGN KEY ("asset_id", "workspace_id") REFERENCES "asset"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
ALTER TABLE "asset_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_feedback" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_feedback"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
