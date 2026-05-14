-- CreateEnum
CREATE TYPE "Role" AS ENUM ('manager', 'hr_admin');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('hired', 'rejected', 'in_progress');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('biased_language', 'criteria_drift', 'asymmetric_concern', 'hedging_language', 'age_bias');

-- CreateEnum
CREATE TYPE "NationalityStatus" AS ENUM ('citizen', 'pr', 'ep_holder', 's_pass', 'other');

-- CreateEnum
CREATE TYPE "Race" AS ENUM ('chinese', 'malay', 'indian', 'other');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('under_30', 'age_30_39', 'age_40_49', 'age_50_plus');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managers" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'manager',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_applied_for" TEXT NOT NULL,
    "nationality_status" "NationalityStatus",
    "race" "Race",
    "age_band" "AgeBand",
    "gender" "Gender",
    "self_reported_demographics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_candidates" (
    "meeting_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,

    CONSTRAINT "meeting_candidates_pkey" PRIMARY KEY ("meeting_id","candidate_id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL DEFAULT 'in_progress',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "flag_type" "FlagType" NOT NULL,
    "excerpt" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "suggested_alt" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismiss_reason" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'pending',
    "model_version" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_org_id_idx" ON "departments"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "managers_clerk_user_id_key" ON "managers"("clerk_user_id");

-- CreateIndex
CREATE INDEX "managers_org_id_idx" ON "managers"("org_id");

-- CreateIndex
CREATE INDEX "candidates_org_id_idx" ON "candidates"("org_id");

-- CreateIndex
CREATE INDEX "meetings_manager_id_idx" ON "meetings"("manager_id");

-- CreateIndex
CREATE INDEX "meetings_org_id_idx" ON "meetings"("org_id");

-- CreateIndex
CREATE INDEX "decisions_manager_id_idx" ON "decisions"("manager_id");

-- CreateIndex
CREATE INDEX "decisions_org_id_idx" ON "decisions"("org_id");

-- CreateIndex
CREATE INDEX "flags_meeting_id_idx" ON "flags"("meeting_id");

-- CreateIndex
CREATE INDEX "flags_org_id_idx" ON "flags"("org_id");

-- CreateIndex
CREATE INDEX "analysis_runs_meeting_id_idx" ON "analysis_runs"("meeting_id");

-- CreateIndex
CREATE INDEX "analysis_runs_org_id_idx" ON "analysis_runs"("org_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managers" ADD CONSTRAINT "managers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managers" ADD CONSTRAINT "managers_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_candidates" ADD CONSTRAINT "meeting_candidates_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_candidates" ADD CONSTRAINT "meeting_candidates_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_dismissed_by_fkey" FOREIGN KEY ("dismissed_by") REFERENCES "managers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
