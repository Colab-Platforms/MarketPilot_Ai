CREATE TABLE "email_otp" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_otp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_otp_user_id_created_at_idx" ON "email_otp"("user_id", "created_at");
ALTER TABLE "email_otp" ADD CONSTRAINT "email_otp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
