ALTER TABLE "VotingToken"
  ADD COLUMN "student_identifier" VARCHAR(100),
  ADD COLUMN "student_name" VARCHAR(255),
  ADD COLUMN "student_class" VARCHAR(100),
  ADD COLUMN "student_email" VARCHAR(255),
  ADD COLUMN "email_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN "email_error" TEXT;

CREATE INDEX "idx_voting_token_election_used_at"
  ON "VotingToken"("election_id", "used_at");

CREATE INDEX "idx_voting_token_election_student_email"
  ON "VotingToken"("election_id", "student_email");

CREATE UNIQUE INDEX "voting_token_election_student_identifier_key"
  ON "VotingToken"("election_id", "student_identifier");
