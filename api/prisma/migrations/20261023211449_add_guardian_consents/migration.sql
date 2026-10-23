-- AlterEnum
ALTER TYPE "ModerationAction" ADD VALUE 'GUARDIAN_DELETE_USER';

-- CreateTable
CREATE TABLE "guardian_consents" (
    "user_id" UUID NOT NULL,
    "guardian_email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(64),
    "token_expires_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_consents_token_hash_key" ON "guardian_consents"("token_hash");

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
