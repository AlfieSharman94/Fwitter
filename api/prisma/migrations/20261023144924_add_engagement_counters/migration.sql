-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quote_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reply_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repost_count" INTEGER NOT NULL DEFAULT 0;


-- Backfill from the rows the counters summarise, so existing posts rank correctly.
UPDATE "posts" p SET
  "like_count"   = (SELECT count(*) FROM "post_likes" l WHERE l."post_id" = p."id"),
  "reply_count"  = (SELECT count(*) FROM "posts" r WHERE r."parent_post_id" = p."id"),
  "repost_count" = (SELECT count(*) FROM "posts" r WHERE r."repost_of_id" = p."id"),
  "quote_count"  = (SELECT count(*) FROM "posts" q WHERE q."quoted_post_id" = p."id");
