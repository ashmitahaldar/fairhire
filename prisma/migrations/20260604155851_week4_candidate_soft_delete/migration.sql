-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "candidates_org_id_deleted_at_idx" ON "candidates"("org_id", "deleted_at");
