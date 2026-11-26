-- AlterEnum
ALTER TYPE "ReelTakeKind" ADD VALUE 'clip';

-- AlterTable
ALTER TABLE "reel_take" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duration_seconds" DOUBLE PRECISION,
ADD COLUMN     "lease_until" TIMESTAMP(3),
ADD COLUMN     "poll_after" TIMESTAMP(3),
ADD COLUMN     "provider_job_id" TEXT,
ADD COLUMN     "route" TEXT;

-- CreateIndex
CREATE INDEX "reel_take_kind_status_poll_after_idx" ON "reel_take"("kind", "status", "poll_after");

