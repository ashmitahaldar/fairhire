-- Close the duplicate-Decision race: one Decision row per (meeting, candidate).
-- The Flag Review decision panel could otherwise POST twice if a fast double-
-- click landed before the meeting query refetched the existing decision id.

-- CreateIndex
CREATE UNIQUE INDEX "decisions_meeting_id_candidate_id_key" ON "decisions"("meeting_id", "candidate_id");
