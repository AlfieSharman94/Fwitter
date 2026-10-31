-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "LinkShare" AS ENUM ('POSTS', 'REPLIES', 'REPOSTS', 'QUOTES', 'FOLLOWS', 'MESSAGES');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LINK';

-- CreateTable
CREATE TABLE "account_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sharer_id" UUID NOT NULL,
    "viewer_id" UUID NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'PENDING',
    "shares" "LinkShare"[],
    "requested_shares" "LinkShare"[] DEFAULT ARRAY[]::"LinkShare"[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(6),
    "stay_answered_at" TIMESTAMPTZ(6),

    CONSTRAINT "account_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_links_viewer_id_idx" ON "account_links"("viewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_links_sharer_id_viewer_id_key" ON "account_links"("sharer_id", "viewer_id");

-- AddForeignKey
ALTER TABLE "account_links" ADD CONSTRAINT "account_links_sharer_id_fkey" FOREIGN KEY ("sharer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "account_links" ADD CONSTRAINT "account_links_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
