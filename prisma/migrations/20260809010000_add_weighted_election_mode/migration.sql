CREATE TYPE "ElectionMode" AS ENUM ('STANDARD', 'WEIGHTED_FIVE');

ALTER TYPE "VoterType" ADD VALUE IF NOT EXISTS 'OSIS';
ALTER TYPE "VoterType" ADD VALUE IF NOT EXISTS 'MPK';
ALTER TYPE "VoterType" ADD VALUE IF NOT EXISTS 'GURU';

ALTER TABLE "Election"
  ADD COLUMN "mode" "ElectionMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "google_sheets_synced_at" TIMESTAMPTZ(6),
  ADD COLUMN "google_sheets_sync_error" TEXT;

ALTER TABLE "Vote"
  ADD COLUMN "voter_type" "VoterType";

CREATE INDEX "idx_vote_election_voter_type"
  ON "Vote"("election_id", "voter_type");
