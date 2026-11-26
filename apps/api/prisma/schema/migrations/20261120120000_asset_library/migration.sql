-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('upload', 'generated');

-- CreateTable
CREATE TABLE "asset" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "kind" "AssetKind" NOT NULL,
    "source" "AssetSource" NOT NULL,
    "url" TEXT NOT NULL,
    "media_type" TEXT,
    "name" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "duration_seconds" DOUBLE PRECISION,
    "studio_output_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_studio_output_id_key" ON "asset"("studio_output_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_workspace_id_url_key" ON "asset"("workspace_id", "url");

-- CreateIndex
CREATE INDEX "asset_workspace_id_created_at_id_idx" ON "asset"("workspace_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_brand_id_workspace_id_fkey" FOREIGN KEY ("brand_id", "workspace_id") REFERENCES "brand"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: row-level security, same policy as every tenant table (see onboarding_foundation).
ALTER TABLE "asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);

-- Hand-written: images the studio made before the library existed. The output id is a
-- UUIDv7 already, so it is reused as the asset id.
INSERT INTO "asset" (
  "id", "workspace_id", "brand_id", "created_by_user_id", "kind", "source", "url", "media_type",
  "width", "height", "studio_output_id", "created_at", "updated_at"
)
SELECT o."id", o."workspace_id", g."brand_id", g."created_by_user_id", 'image', 'generated', o."url", o."media_type",
       o."width", o."height", o."id", o."created_at", o."created_at"
FROM "studio_output" o
JOIN "studio_generation" g ON g."id" = o."generation_id" AND g."workspace_id" = o."workspace_id"
ON CONFLICT DO NOTHING;
