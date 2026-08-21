-- DropIndex
DROP INDEX "idx_voting_token_election_voter_type";

-- AlterTable
ALTER TABLE "Election" ADD COLUMN     "include_vote_link" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "include_whatsapp_support" BOOLEAN NOT NULL DEFAULT true;
