import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";

import { config } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { assertRole, ServiceError } from "@/services/errors";

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LENGTH = 12;

export interface GenerateTokenBatchInput {
  electionId: string;
  count: number;
  actorId: string;
  actorRole: "ADMIN" | "SUPER_ADMIN";
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ValidateTokenResult {
  electionId: string;
  electionTitle: string;
}

export function hashVotingToken(tokenPlaintext: string): string {
  return crypto
    .createHmac("sha256", config.token.hmacSecret)
    .update(tokenPlaintext.trim().toUpperCase())
    .digest("hex");
}

export function generatePlaintextToken(length = TOKEN_LENGTH): string {
  let token = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = crypto.randomInt(0, TOKEN_ALPHABET.length);
    token += TOKEN_ALPHABET[randomIndex];
  }

  return token;
}

export class TokenService {
  async exportTokenMetadata(electionId: string) {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: { id: true },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    return prisma.votingToken.findMany({
      where: { electionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        usedAt: true,
        createdAt: true,
      },
    });
  }

  async generateTokenBatch(input: GenerateTokenBatchInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    if (input.count < 1 || input.count > 1000) {
      throw new ServiceError("TOKEN_GENERATION_ACTIVE_ONLY", "Jumlah token harus 1-1000.", 422);
    }

    const plaintextTokens = new Set<string>();
    while (plaintextTokens.size < input.count) {
      plaintextTokens.add(generatePlaintextToken());
    }

    const tokens = [...plaintextTokens];
    const hashes = tokens.map((token) => hashVotingToken(token));

    await prisma.$transaction(async (tx) => {
      const election = await tx.election.findUnique({
        where: { id: input.electionId },
        select: { id: true, status: true },
      });

      if (!election) {
        throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
      }

      if (election.status !== "SETUP") {
        throw new ServiceError(
          "TOKEN_GENERATION_ACTIVE_ONLY",
          "Token hanya bisa di-generate saat election SETUP.",
          422,
        );
      }

      await tx.votingToken.createMany({
        data: hashes.map((tokenHash) => ({
          electionId: input.electionId,
          tokenHash,
          createdById: input.actorId,
        })),
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "TOKEN_BATCH_GENERATED",
          targetType: "election",
          targetId: input.electionId,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            count: input.count,
            electionId: input.electionId,
          },
        },
        tx,
      );
    });

    return {
      electionId: input.electionId,
      generatedCount: tokens.length,
      tokens,
    };
  }

  async validateToken(
    tokenPlaintext: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<ValidateTokenResult> {
    const tokenHash = hashVotingToken(tokenPlaintext);
    const votingToken = await tx.votingToken.findUnique({
      where: { tokenHash },
      include: {
        election: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!votingToken || votingToken.usedAt) {
      throw new ServiceError("TOKEN_INVALID", "Token tidak valid atau sudah digunakan.", 400);
    }

    if (votingToken.election.status !== "OPEN") {
      throw new ServiceError("ELECTION_NOT_OPEN", "Voting sedang tidak berlangsung.", 422);
    }

    return {
      electionId: votingToken.election.id,
      electionTitle: votingToken.election.title,
    };
  }
}

export const tokenService = new TokenService();
