-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT', 'FINISHED', 'SUSPENDED', 'POSTPONED', 'CANCELLED', 'AWARDED');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "match_id" UUID;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "external_id" INTEGER;

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" INTEGER NOT NULL,
    "competition" VARCHAR(10) NOT NULL,
    "competition_name" VARCHAR(100) NOT NULL,
    "home_team_id" UUID,
    "away_team_id" UUID,
    "home_name" VARCHAR(100) NOT NULL,
    "away_name" VARCHAR(100) NOT NULL,
    "home_crest" TEXT,
    "away_crest" TEXT,
    "kickoff_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minute" INTEGER,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_external_id_key" ON "matches"("external_id");

-- CreateIndex
CREATE INDEX "matches_kickoff_at_idx" ON "matches"("kickoff_at");

-- CreateIndex
CREATE INDEX "matches_status_kickoff_at_idx" ON "matches"("status", "kickoff_at");

-- CreateIndex
CREATE INDEX "idx_posts_match_created" ON "posts"("match_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "teams_external_id_key" ON "teams"("external_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

