import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { ServiceError } from "@/services/errors";
import { googleSheetsService } from "@/services/google-sheets.service";
import { hashVotingToken } from "@/services/token.service";

interface LockedVotingTokenRow {
  id: string;
  election_id: string;
  used_at: Date | null;
  voter_type: "STUDENT" | "TEACHER" | "OSIS" | "MPK" | "GURU" | null;
}

export interface CastVoteInput {
  token: string;
  candidateId: string;
  electionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class VoteService {
  async castVote(input: CastVoteInput) {
    const tokenHash = hashVotingToken(input.token);
    let sheetRow:
      | {
          tokenId: string;
          electionId: string;
          electionTitle: string;
          voterType: "STUDENT" | "TEACHER" | "OSIS" | "MPK" | "GURU" | null;
          studentIdentifier: string | null;
          studentName: string | null;
          studentClass: string | null;
          studentEmail: string | null;
          emailSentAt: Date | null;
          emailError: string | null;
          usedAt: Date | null;
        }
      | undefined;

    await prisma.$transaction(async (tx) => {
      const lockedTokens = await tx.$queryRaw<LockedVotingTokenRow[]>`
        SELECT id, election_id, used_at, voter_type
        FROM "VotingToken"
        WHERE token_hash = ${tokenHash}
        FOR UPDATE
      `;
      const lockedToken = lockedTokens[0];

      if (!lockedToken) {
        throw new ServiceError("TOKEN_INVALID", "Token tidak valid.", 400);
      }

      if (lockedToken.used_at) {
        throw new ServiceError("TOKEN_ALREADY_USED", "Token sudah digunakan.", 409);
      }

      if (lockedToken.election_id !== input.electionId) {
        throw new ServiceError("TOKEN_INVALID", "Token tidak valid untuk election ini.", 400);
      }

      const election = await tx.election.findUnique({
        where: { id: input.electionId },
        select: { id: true, title: true, status: true, mode: true },
      });

      if (!election) {
        throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
      }

      if (election.status !== "OPEN") {
        throw new ServiceError("ELECTION_NOT_OPEN", "Voting sedang tidak berlangsung.", 422);
      }

      if (
        election.mode === "WEIGHTED_FIVE" &&
        (!lockedToken.voter_type || !["OSIS", "MPK", "GURU"].includes(lockedToken.voter_type))
      ) {
        throw new ServiceError(
          "TOKEN_VOTER_TYPE_INVALID",
          "Token tidak memiliki role OSIS, MPK, atau GURU yang valid.",
          422,
        );
      }

      const candidate = await tx.candidate.findUnique({
        where: { id: input.candidateId },
        select: { id: true, electionId: true },
      });

      if (!candidate) {
        throw new ServiceError("CANDIDATE_NOT_FOUND", "Kandidat tidak ditemukan.", 404);
      }

      if (candidate.electionId !== input.electionId) {
        throw new ServiceError(
          "CANDIDATE_NOT_IN_ELECTION",
          "Kandidat tidak termasuk dalam election ini.",
          422,
        );
      }

      await tx.vote.create({
        data: {
          electionId: input.electionId,
          candidateId: input.candidateId,
          voterType: lockedToken.voter_type,
        },
      });

      const updatedToken = await tx.votingToken.update({
        where: { id: lockedToken.id },
        data: { usedAt: new Date(), tokenCiphertext: null },
        select: {
          id: true,
          electionId: true,
          voterType: true,
          studentIdentifier: true,
          studentName: true,
          studentClass: true,
          studentEmail: true,
          emailSentAt: true,
          emailError: true,
          usedAt: true,
        },
      });

      sheetRow = {
        tokenId: updatedToken.id,
        electionId: updatedToken.electionId,
        electionTitle: election.title,
        voterType: updatedToken.voterType,
        studentIdentifier: updatedToken.studentIdentifier,
        studentName: updatedToken.studentName,
        studentClass: updatedToken.studentClass,
        studentEmail: updatedToken.studentEmail,
        emailSentAt: updatedToken.emailSentAt,
        emailError: updatedToken.emailError,
        usedAt: updatedToken.usedAt,
      };
    });

    if (sheetRow) {
      await googleSheetsService.syncTokenRow(sheetRow);
    }

    await auditService.writeLog({
      actorId: null,
      action: "VOTE_CAST",
      targetType: "election",
      targetId: input.electionId,
      result: "SUCCESS",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {},
    });

    return {
      message: "Suara berhasil dicatat. Terima kasih telah berpartisipasi.",
    };
  }
}

export const voteService = new VoteService();
