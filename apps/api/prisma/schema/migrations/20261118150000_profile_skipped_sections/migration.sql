-- AlterTable
ALTER TABLE "brand_profile" ADD COLUMN "skipped_sections" TEXT[] DEFAULT ARRAY[]::TEXT[];
