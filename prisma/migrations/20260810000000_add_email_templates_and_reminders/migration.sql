ALTER TYPE "AuditAction" ADD VALUE 'TOKEN_REMINDER_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'ELECTION_EMAIL_TEMPLATE_UPDATED';

ALTER TABLE "Election"
ADD COLUMN "token_email_subject" VARCHAR(200),
ADD COLUMN "token_email_message" TEXT,
ADD COLUMN "reminder_email_subject" VARCHAR(200),
ADD COLUMN "reminder_email_message" TEXT,
ADD COLUMN "reminder_queued_at" TIMESTAMPTZ(6),
ADD COLUMN "reminder_completed_at" TIMESTAMPTZ(6);

ALTER TABLE "VotingToken"
ADD COLUMN "reminder_sent_at" TIMESTAMPTZ(6),
ADD COLUMN "reminder_error" TEXT;

CREATE INDEX "idx_voting_token_election_reminder_sent_at"
ON "VotingToken"("election_id", "reminder_sent_at");
