-- AlterTable
ALTER TABLE "auth_session" ADD COLUMN "previous_token_hash" TEXT,
ADD COLUMN "rotated_at" TIMESTAMP(3);
