-- CreateTable
CREATE TABLE "post_mentions" (
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "post_mentions_pkey" PRIMARY KEY ("post_id","user_id")
);

-- CreateTable
CREATE TABLE "hashtags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tag" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_hashtags" (
    "post_id" UUID NOT NULL,
    "hashtag_id" UUID NOT NULL,

    CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id","hashtag_id")
);

-- CreateIndex
CREATE INDEX "post_mentions_user_id_idx" ON "post_mentions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_tag_key" ON "hashtags"("tag");

-- CreateIndex
CREATE INDEX "post_hashtags_hashtag_id_idx" ON "post_hashtags"("hashtag_id");

-- AddForeignKey
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

