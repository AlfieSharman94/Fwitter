-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('HIDE_POST', 'RESTORE_POST', 'DELETE_POST', 'WARN_USER', 'SUSPEND_USER', 'UNSUSPEND_USER', 'BAN_USER', 'UNBAN_USER', 'SET_ROLE', 'DISMISS_REPORTS', 'ADD_BANNED_WORD', 'REMOVE_BANNED_WORD');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WARNING';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "note" VARCHAR(300);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "banned_at" TIMESTAMPTZ(6),
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN     "suspended_until" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" "ModerationAction" NOT NULL,
    "target_user_id" UUID,
    "target_post_id" UUID,
    "post_snapshot" TEXT,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_actions_created_at_idx" ON "moderation_actions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "moderation_actions_target_user_id_idx" ON "moderation_actions"("target_user_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_post_id_idx" ON "moderation_actions"("target_post_id");

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

