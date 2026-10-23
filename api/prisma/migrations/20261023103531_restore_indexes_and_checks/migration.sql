-- Restores the database objects that were lost when the migration history was baselined.
-- Prisma cannot express expression indexes, partial indexes or CHECK constraints, so the
-- generated 0_init omitted them and any database built purely from migrations (production)
-- lacks them. Everything here is IF NOT EXISTS, so it is a no-op on databases that still
-- carry the originals (local dev).

-- Case-insensitive uniqueness for usernames and emails.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_username_unique" ON "public"."users" (lower("username"));
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email_unique" ON "public"."users" (lower("email"));

-- Catalog name indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_topics_name_unique" ON "public"."topics" (lower("name"));
CREATE INDEX IF NOT EXISTS "idx_teams_name" ON "public"."teams" (lower("name"));

-- At most one primary team per user.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_primary_team" ON "public"."user_teams" ("user_id") WHERE "is_primary" = true;

-- A user cannot follow themselves. ADD CONSTRAINT has no IF NOT EXISTS form.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'no_self_follow' AND conrelid = 'public.follows'::regclass
  ) THEN
    ALTER TABLE "public"."follows" ADD CONSTRAINT "no_self_follow" CHECK ("follower_id" <> "following_id");
  END IF;
END $$;
