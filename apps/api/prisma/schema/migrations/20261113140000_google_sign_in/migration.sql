ALTER TABLE "user" ADD COLUMN "google_sub" TEXT;
ALTER TABLE "user" ADD COLUMN "email_verified_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "user_google_sub_key" ON "user"("google_sub");
