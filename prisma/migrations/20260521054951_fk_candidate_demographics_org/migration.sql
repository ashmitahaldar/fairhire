/*
  Warnings:

  - A unique constraint covering the columns `[candidate_id,org_id]` on the table `candidate_demographics` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,org_id]` on the table `candidates` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "candidate_demographics" DROP CONSTRAINT "candidate_demographics_candidate_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "candidate_demographics_candidate_id_org_id_key" ON "candidate_demographics"("candidate_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_id_org_id_key" ON "candidates"("id", "org_id");

-- AddForeignKey
ALTER TABLE "candidate_demographics" ADD CONSTRAINT "candidate_demographics_candidate_id_org_id_fkey" FOREIGN KEY ("candidate_id", "org_id") REFERENCES "candidates"("id", "org_id") ON DELETE CASCADE ON UPDATE CASCADE;
