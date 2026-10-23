-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "quoted_post_id" UUID,
ADD COLUMN     "repost_of_id" UUID;

-- CreateIndex
CREATE INDEX "idx_posts_repost_of" ON "posts"("repost_of_id");

-- CreateIndex
CREATE INDEX "idx_posts_quoted" ON "posts"("quoted_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_posts_one_repost_per_user" ON "posts"("author_id", "repost_of_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_repost_of_id_fkey" FOREIGN KEY ("repost_of_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_quoted_post_id_fkey" FOREIGN KEY ("quoted_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

