-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('SETUP', 'READY', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ADMIN_CREATED', 'ADMIN_UPDATED', 'ADMIN_DEACTIVATED', 'ADMIN_PASSWORD_CHANGED', 'ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ELECTION_CREATED', 'ELECTION_STATUS_CHANGED', 'ELECTION_DELETED', 'CANDIDATE_CREATED', 'CANDIDATE_UPDATED', 'CANDIDATE_DELETED', 'TOKEN_BATCH_GENERATED', 'TOKEN_BATCH_EXPORTED', 'VOTE_CAST', 'BACKUP_RESTORED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ElectionStatus" NOT NULL DEFAULT 'SETUP',
    "opened_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "order_number" SMALLINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "class_name" VARCHAR(50) NOT NULL,
    "photo_url" TEXT,
    "vision" TEXT NOT NULL,
    "missions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingToken" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "voted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" VARCHAR(100),
    "result" "AuditResult" NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "idx_admin_username" ON "Admin"("username");

-- CreateIndex
CREATE INDEX "idx_admin_email" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "idx_admin_role" ON "Admin"("role");

-- CreateIndex
CREATE INDEX "idx_admin_is_active" ON "Admin"("is_active");

-- CreateIndex
CREATE INDEX "idx_election_status" ON "Election"("status");

-- CreateIndex
CREATE INDEX "idx_election_created_by" ON "Election"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "idx_one_active_election" ON "Election"("status") WHERE "status" IN ('OPEN', 'PAUSED');

-- CreateIndex
CREATE INDEX "idx_candidate_election_id" ON "Candidate"("election_id");

-- CreateIndex
CREATE INDEX "idx_candidate_election_order" ON "Candidate"("election_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_election_order_number_key" ON "Candidate"("election_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "VotingToken_token_hash_key" ON "VotingToken"("token_hash");

-- CreateIndex
CREATE INDEX "idx_voting_token_hash" ON "VotingToken"("token_hash");

-- CreateIndex
CREATE INDEX "idx_voting_token_election_id" ON "VotingToken"("election_id");

-- CreateIndex
CREATE INDEX "idx_voting_token_unused" ON "VotingToken"("used_at") WHERE "used_at" IS NULL;

-- CreateIndex
CREATE INDEX "idx_voting_token_created_by" ON "VotingToken"("created_by");

-- CreateIndex
CREATE INDEX "idx_vote_election_id" ON "Vote"("election_id");

-- CreateIndex
CREATE INDEX "idx_vote_candidate_id" ON "Vote"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_vote_election_candidate" ON "Vote"("election_id", "candidate_id");

-- CreateIndex
CREATE INDEX "idx_vote_voted_at" ON "Vote"("voted_at");

-- CreateIndex
CREATE INDEX "idx_audit_actor_id" ON "AuditLog"("actor_id");

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_target" ON "AuditLog"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_audit_result" ON "AuditLog"("result");

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingToken" ADD CONSTRAINT "VotingToken_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingToken" ADD CONSTRAINT "VotingToken_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual constraints not representable in Prisma schema.
ALTER TABLE "Candidate" ADD CONSTRAINT "candidate_order_number_range_check" CHECK ("order_number" BETWEEN 1 AND 5);
ALTER TABLE "VotingToken" ADD CONSTRAINT "voting_token_used_at_after_created_at_check" CHECK ("used_at" IS NULL OR "used_at" >= "created_at");
