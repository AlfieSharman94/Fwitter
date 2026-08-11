-- CreateEnum
CREATE TYPE "AgeTier" AS ENUM ('JUNIOR', 'STANDARD');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age_tier" "AgeTier" NOT NULL DEFAULT 'STANDARD';

