import crypto from "node:crypto";

import { Prisma, type VoterType } from "@prisma/client";

import { config } from "@/config/env";
import { MAX_TOKEN_BATCH_SIZE } from "@/config/tokens";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { emailService } from "@/services/email.service";
import { assertRole, ServiceError } from "@/services/errors";
import { googleSheetsService } from "@/services/google-sheets.service";

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LENGTH = 12;
const MAX_TOKEN_GENERATION_ATTEMPTS = 10;
const MAX_TOKEN_INSERT_ATTEMPTS = 3;

export interface GenerateTokenBatchInput {
  electionId: string;
  count?: number | undefined;
  students?: TokenStudentAssignmentInput[] | undefined;
  actorId: string;
  actorRole: "ADMIN" | "SUPER_ADMIN";
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface TokenStudentAssignmentInput {
  studentIdentifier: string;
  studentName: string;
  studentClass?: string | null | undefined;
  studentEmail?: string | null | undefined;
  voterType?: VoterType | undefined;
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
  async listTokenMetadata(electionId: string) {
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
        studentIdentifier: true,
        studentName: true,
        studentClass: true,
        studentEmail: true,
        voterType: true,
        emailSentAt: true,
        emailError: true,
        usedAt: true,
        createdAt: true,
      },
    });
  }

  async exportTokenMetadata(electionId: string) {
    return this.listTokenMetadata(electionId);
  }

  async generateTokenBatch(input: GenerateTokenBatchInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);
    const students = normalizeStudentAssignments(input.students);
    const count = students?.length ?? input.count ?? 0;

    if (count < 1 || count > MAX_TOKEN_BATCH_SIZE) {
      throw new ServiceError(
        "TOKEN_GENERATION_ACTIVE_ONLY",
        `Jumlah token harus 1-${MAX_TOKEN_BATCH_SIZE}.`,
        422,
      );
    }

    for (let attempt = 1; attempt <= MAX_TOKEN_INSERT_ATTEMPTS; attempt += 1) {
      const { tokens, hashes } = await this.generateUnusedTokens(count);

      try {
        const election = await this.insertTokenBatch(
          students ? { ...input, count, students } : { ...input, count },
          tokens,
          hashes,
        );
        const emailResults =
          students && students.some((student) => student.studentEmail)
            ? await this.sendTokenEmails({
                electionId: input.electionId,
                electionTitle: election.title,
                tokens,
                hashes,
                students,
              })
            : undefined;
        if (students && !emailResults) {
          await this.syncTokensToSheet(input.electionId, election.title, hashes);
        }

        return {
          electionId: input.electionId,
          generatedCount: tokens.length,
          tokens: students ? [] : tokens,
          assignedTokens: students
            ? students.map((student, index) => ({
                emailStatus: emailResults?.[index]?.status ?? "SKIPPED",
                emailError: emailResults?.[index]?.error ?? null,
                ...student,
              }))
            : undefined,
          emailSummary: emailResults
            ? {
                sent: emailResults.filter((result) => result.status === "SENT").length,
                failed: emailResults.filter((result) => result.status === "FAILED").length,
                skipped: emailResults.filter((result) => result.status === "SKIPPED").length,
              }
            : undefined,
        };
      } catch (error) {
        if (attempt < MAX_TOKEN_INSERT_ATTEMPTS && isRetryableTokenConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ServiceError(
      "TOKEN_GENERATION_FAILED",
      "Gagal membuat token unik. Silakan coba lagi.",
      500,
    );
  }

  private async generateUnusedTokens(count: number) {
    const tokenByHash = new Map<string, string>();

    for (let attempt = 1; attempt <= MAX_TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
      while (tokenByHash.size < count) {
        const token = generatePlaintextToken();
        tokenByHash.set(hashVotingToken(token), token);
      }

      const existingTokens = await prisma.votingToken.findMany({
        where: {
          tokenHash: {
            in: [...tokenByHash.keys()],
          },
        },
        select: {
          tokenHash: true,
        },
      });

      if (existingTokens.length === 0) {
        return {
          tokens: [...tokenByHash.values()],
          hashes: [...tokenByHash.keys()],
        };
      }

      for (const existingToken of existingTokens) {
        tokenByHash.delete(existingToken.tokenHash);
      }
    }

    throw new ServiceError(
      "TOKEN_GENERATION_FAILED",
      "Gagal membuat token unik. Silakan coba lagi.",
      500,
    );
  }

  private async insertTokenBatch(
    input: GenerateTokenBatchInput & {
      count: number;
      students?: TokenStudentAssignmentInput[] | undefined;
    },
    tokens: string[],
    hashes: string[],
  ) {
    return prisma.$transaction(async (tx) => {
      const election = await tx.election.findUnique({
        where: { id: input.electionId },
        select: { id: true, title: true, status: true },
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

      if (input.students) {
        const existingAssignedTokens = await tx.votingToken.findMany({
          where: {
            electionId: input.electionId,
            studentIdentifier: {
              in: input.students.map((student) => student.studentIdentifier),
            },
          },
          select: {
            studentIdentifier: true,
          },
        });

        if (existingAssignedTokens.length > 0) {
          throw new ServiceError(
            "TOKEN_STUDENT_ALREADY_ASSIGNED",
            `Token untuk siswa ${existingAssignedTokens
              .map((token) => token.studentIdentifier)
              .filter(Boolean)
              .join(", ")} sudah pernah dibuat.`,
            409,
          );
        }
      }

      await tx.votingToken.createMany({
        data: hashes.map((tokenHash, index) => {
          const student = input.students?.[index];

          return {
            electionId: input.electionId,
            tokenHash,
            tokenCiphertext: student?.studentEmail
              ? encryptTokenPlaintext(tokens[index] ?? "")
              : null,
            voterType: student?.voterType ?? null,
            studentIdentifier: student?.studentIdentifier ?? null,
            studentName: student?.studentName ?? null,
            studentClass: student?.studentClass ?? null,
            studentEmail: student?.studentEmail ?? null,
            createdById: input.actorId,
          };
        }),
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
            assignedToStudents: Boolean(input.students),
            emailRequested: Boolean(input.students?.some((student) => student.studentEmail)),
            electionId: input.electionId,
          },
        },
        tx,
      );

      return election;
    });
  }

  private async sendTokenEmails(input: {
    electionId: string;
    electionTitle: string;
    tokens: string[];
    hashes: string[];
    students: TokenStudentAssignmentInput[];
  }) {
    const results: Array<{
      status: "SENT" | "FAILED" | "SKIPPED";
      error: string | null;
    }> = new Array(input.students.length);
    let emailSendIndex = 0;
    for (const [index, student] of input.students.entries()) {
      const tokenHash = input.hashes[index];
      const token = input.tokens[index];

      if (!student) {
        results[index] = {
          status: "SKIPPED",
          error: "Data siswa tidak ditemukan.",
        };
        continue;
      }

      if (!tokenHash || !token || !student.studentEmail) {
        results[index] = {
          status: "SKIPPED",
          error: student.studentEmail ? "Token tidak ditemukan." : "Email siswa kosong.",
        };
        continue;
      }

      await delayBeforeEmail(emailSendIndex);
      emailSendIndex += 1;

      const result = await emailService.sendVotingToken({
        to: student.studentEmail,
        studentName: student.studentName,
        studentIdentifier: student.studentIdentifier,
        electionTitle: input.electionTitle,
        token,
        voteUrl: buildTokenVoteUrl(token),
      });
      const emailError = result.ok ? null : (result.error ?? "Gagal mengirim email.");

      await prisma.votingToken.update({
        where: { tokenHash },
        data: {
          emailSentAt: result.ok ? new Date() : null,
          emailError,
        },
      });

      results[index] = {
        status: result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED",
        error: emailError,
      };
    }

    await this.syncTokensToSheet(input.electionId, input.electionTitle, input.hashes);

    return results;
  }

  async retryFailedTokenEmails(input: {
    electionId: string;
    actorId: string;
    actorRole: "ADMIN" | "SUPER_ADMIN";
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    const election = await prisma.election.findUnique({
      where: { id: input.electionId },
      select: { id: true, title: true },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    const retryableTokens = await prisma.votingToken.findMany({
      where: {
        electionId: input.electionId,
        usedAt: null,
        emailSentAt: null,
        studentEmail: { not: null },
        tokenCiphertext: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        tokenCiphertext: true,
        studentIdentifier: true,
        studentName: true,
        studentEmail: true,
      },
    });

    const electionTitle = election.title;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let emailSendIndex = 0;

    for (const tokenRecord of retryableTokens) {
      if (!tokenRecord?.studentEmail || !tokenRecord.tokenCiphertext) {
        skipped += 1;
        continue;
      }

      let plaintextToken: string;
      try {
        plaintextToken = decryptTokenPlaintext(tokenRecord.tokenCiphertext);
      } catch {
        failed += 1;
        const updatedToken = await prisma.votingToken.update({
          where: { id: tokenRecord.id },
          data: { emailError: "Token terenkripsi tidak dapat dibuka untuk retry." },
          select: tokenSheetSelect(),
        });
        await googleSheetsService.syncTokenRow(mapTokenToSheetRow(updatedToken, electionTitle));
        continue;
      }

      await delayBeforeEmail(emailSendIndex);
      emailSendIndex += 1;

      const result = await emailService.sendVotingToken({
        to: tokenRecord.studentEmail,
        studentName: tokenRecord.studentName ?? tokenRecord.studentIdentifier ?? "Pemilih",
        studentIdentifier: tokenRecord.studentIdentifier ?? "-",
        electionTitle,
        token: plaintextToken,
        voteUrl: buildTokenVoteUrl(plaintextToken),
      });

      const updatedToken = await prisma.votingToken.update({
        where: { id: tokenRecord.id },
        data: {
          emailSentAt: result.ok ? new Date() : null,
          emailError: result.ok ? null : (result.error ?? "Gagal mengirim email."),
        },
        select: tokenSheetSelect(),
      });

      await googleSheetsService.syncTokenRow(mapTokenToSheetRow(updatedToken, electionTitle));

      if (result.ok) {
        sent += 1;
      } else if (result.skipped) {
        skipped += 1;
      } else {
        failed += 1;
      }
    }

    await auditService.writeLog({
      actorId: input.actorId,
      action: "TOKEN_EMAIL_RETRIED",
      targetType: "election",
      targetId: input.electionId,
      result: "SUCCESS",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        electionId: input.electionId,
        attempted: retryableTokens.length,
        sent,
        failed,
        skipped,
      },
    });

    return {
      attempted: retryableTokens.length,
      sent,
      failed,
      skipped,
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

  private async syncTokensToSheet(
    electionId: string,
    electionTitle: string,
    tokenHashes: string[],
  ) {
    if (!googleSheetsService.enabled || tokenHashes.length === 0) {
      return;
    }

    const tokens = await prisma.votingToken.findMany({
      where: {
        electionId,
        tokenHash: { in: tokenHashes },
      },
      orderBy: { createdAt: "asc" },
      select: tokenSheetSelect(),
    });

    await googleSheetsService.syncTokenRows(
      tokens.map((token) => mapTokenToSheetRow(token, electionTitle)),
    );
  }
}

function buildTokenVoteUrl(token: string) {
  const url = new URL("/vote", config.app.publicUrl.replace(/\/$/, ""));
  url.searchParams.set("token", token);
  return url.toString();
}

async function delayBeforeEmail(index: number) {
  if (index <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, config.mail.sendDelayMs));
}

function tokenSheetSelect() {
  return {
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
  } as const;
}

function mapTokenToSheetRow(
  token: {
    id: string;
    electionId: string;
    voterType: VoterType | null;
    studentIdentifier: string | null;
    studentName: string | null;
    studentClass: string | null;
    studentEmail: string | null;
    emailSentAt: Date | null;
    emailError: string | null;
    usedAt: Date | null;
  },
  electionTitle: string,
) {
  return {
    tokenId: token.id,
    electionId: token.electionId,
    electionTitle,
    voterType: token.voterType,
    studentIdentifier: token.studentIdentifier,
    studentName: token.studentName,
    studentClass: token.studentClass,
    studentEmail: token.studentEmail,
    emailSentAt: token.emailSentAt,
    emailError: token.emailError,
    usedAt: token.usedAt,
  };
}

function normalizeStudentAssignments(students?: TokenStudentAssignmentInput[]) {
  if (!students) {
    return undefined;
  }

  const normalized = students.map((student) => ({
    studentIdentifier: student.studentIdentifier.trim().toUpperCase(),
    studentName: student.studentName.trim(),
    studentClass: student.studentClass?.trim() || null,
    studentEmail: student.studentEmail?.trim().toLowerCase() || null,
    voterType: student.voterType ?? "STUDENT",
  }));

  const identifiers = new Set<string>();
  for (const student of normalized) {
    if (identifiers.has(student.studentIdentifier)) {
      throw new ServiceError(
        "TOKEN_STUDENT_DUPLICATE",
        "NIS/ID siswa tidak boleh duplikat dalam satu batch.",
        422,
      );
    }
    identifiers.add(student.studentIdentifier);
  }

  return normalized;
}

function isRetryableTokenConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("token_hash")
  );
}

function encryptTokenPlaintext(tokenPlaintext: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(tokenPlaintext, "utf8"),
    cipher.final(),
  ]).toString("base64url");
  const tag = cipher.getAuthTag().toString("base64url");

  return `v1:${iv.toString("base64url")}:${tag}:${ciphertext}`;
}

function decryptTokenPlaintext(encryptedToken: string) {
  const [version, ivText, tagText, ciphertextText] = encryptedToken.split(":");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) {
    throw new Error("Format token terenkripsi tidak valid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    tokenEncryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function tokenEncryptionKey() {
  return crypto.createHash("sha256").update(config.token.hmacSecret).digest();
}

export const tokenService = new TokenService();
