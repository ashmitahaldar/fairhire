/*
  Warnings:

  - You are about to drop the column `age_band` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `nationality_status` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `race` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `self_reported_demographics` on the `candidates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "candidates" DROP COLUMN "age_band",
DROP COLUMN "gender",
DROP COLUMN "nationality_status",
DROP COLUMN "race",
DROP COLUMN "self_reported_demographics";

-- CreateTable
CREATE TABLE "candidate_demographics" (
    "candidate_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "nationality_status" "NationalityStatus",
    "race" "Race",
    "age_band" "AgeBand",
    "gender" "Gender",
    "first_language" TEXT,
    "years_in_singapore" INTEGER,
    "university" TEXT,
    "major" TEXT,
    "previous_employer" TEXT,
    "years_experience" INTEGER,
    "current_base" TEXT,

    CONSTRAINT "candidate_demographics_pkey" PRIMARY KEY ("candidate_id")
);

-- CreateIndex
CREATE INDEX "candidate_demographics_org_id_idx" ON "candidate_demographics"("org_id");

-- AddForeignKey
ALTER TABLE "candidate_demographics" ADD CONSTRAINT "candidate_demographics_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
