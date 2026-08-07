ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TOKEN_EMAIL_RETRIED';

CREATE TYPE "VoterType" AS ENUM ('STUDENT', 'TEACHER');

ALTER TABLE "VotingToken"
  ADD COLUMN "token_ciphertext" TEXT,
  ADD COLUMN "voter_type" "VoterType";

CREATE INDEX "idx_voting_token_election_email_retry"
  ON "VotingToken"("election_id", "email_sent_at", "used_at")
  WHERE "student_email" IS NOT NULL;

CREATE INDEX "idx_voting_token_election_voter_type"
  ON "VotingToken"("election_id", "voter_type");
