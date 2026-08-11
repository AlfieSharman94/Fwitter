-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."follows" (
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

-- CreateTable
CREATE TABLE "public"."post_teams" (
    "post_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,

    CONSTRAINT "post_teams_pkey" PRIMARY KEY ("post_id","team_id")
);

-- CreateTable
CREATE TABLE "public"."post_topics" (
    "post_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,

    CONSTRAINT "post_topics_pkey" PRIMARY KEY ("post_id","topic_id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "parent_post_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "short_name" VARCHAR(50),
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "league" VARCHAR(100),
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_teams" (
    "user_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_teams_pkey" PRIMARY KEY ("user_id","team_id")
);

-- CreateTable
CREATE TABLE "public"."user_topics" (
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_topics_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(30) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "bio" TEXT,
    "profile_image_url" TEXT,
    "date_of_birth" DATE NOT NULL,
    "is_onboarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "cognito_sub" VARCHAR(64),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "public"."follows"("follower_id" ASC);

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "public"."follows"("following_id" ASC);

-- CreateIndex
CREATE INDEX "idx_posts_author_created" ON "public"."posts"("author_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_posts_parent" ON "public"."posts"("parent_post_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognito_sub_key" ON "public"."users"("cognito_sub" ASC);

-- AddForeignKey
ALTER TABLE "public"."follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_teams" ADD CONSTRAINT "post_teams_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_teams" ADD CONSTRAINT "post_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_topics" ADD CONSTRAINT "post_topics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_topics" ADD CONSTRAINT "post_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_teams" ADD CONSTRAINT "user_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_teams" ADD CONSTRAINT "user_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_topics" ADD CONSTRAINT "user_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_topics" ADD CONSTRAINT "user_topics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

