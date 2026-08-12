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
  studentIdentifier?: string | null | undefined;
  studentName: string;
  studentClass?: string | null | undefined;
  studentEmail?: string | null | undefined;
  voterType?: VoterType | undefined;
}

export interface UpdateTokenEmailInput {
  tokenId: string;
  studentEmail: string;
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
  private readonly activeEmailDeliveries = new Set<string>();
  private readonly activeReminderDeliveries = new Set<string>();

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
        reminderSentAt: true,
        reminderError: true,
        usedAt: true,
        createdAt: true,
      },
    });
  }

  async exportTokenMetadata(electionId: string) {
    return this.listTokenMetadata(electionId);
  }

  async updateTokenEmail(input: UpdateTokenEmailInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);
    const studentEmail = input.studentEmail.trim().toLowerCase();

    const token = await prisma.votingToken.findUnique({
      where: { id: input.tokenId },
      select: {
        id: true,
        electionId: true,
        studentEmail: true,
        emailSentAt: true,
        usedAt: true,
        election: { select: { status: true } },
      },
    });

    if (!token) {
      throw new ServiceError("TOKEN_NOT_FOUND", "Token pemilih tidak ditemukan.", 404);
    }
    if (token.usedAt) {
      throw new ServiceError(
        "TOKEN_ALREADY_USED",
        "Email tidak dapat diubah karena token sudah dipakai.",
        422,
      );
    }
    if (["CLOSED", "ARCHIVED"].includes(token.election.status)) {
      throw new ServiceError(
        "ELECTION_WRONG_STATE",
        "Email tidak dapat diubah setelah election ditutup atau diarsipkan.",
        422,
      );
    }
    if (token.studentEmail?.toLowerCase() === studentEmail) {
      throw new ServiceError(
        "TOKEN_EMAIL_UNCHANGED",
        "Email baru sama dengan email yang tersimpan.",
        422,
      );
    }
    if (
      this.activeEmailDeliveries.has(token.electionId) ||
      this.activeReminderDeliveries.has(token.electionId)
    ) {
      throw new ServiceError(
        "TOKEN_EMAIL_DELIVERY_BUSY",
        "Email tidak dapat diubah saat pengiriman token atau reminder sedang berjalan.",
        409,
      );
    }

    this.activeEmailDeliveries.add(token.electionId);
    try {
      const duplicate = await prisma.votingToken.findFirst({
        where: {
          electionId: token.electionId,
          id: { not: token.id },
          studentEmail: { equals: studentEmail, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ServiceError(
          "TOKEN_EMAIL_ALREADY_ASSIGNED",
          "Email sudah digunakan pemilih lain pada election ini.",
          409,
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.votingToken.update({
          where: { id: token.id },
          data: {
            studentEmail,
            emailSentAt: null,
            emailError: null,
            reminderSentAt: null,
            reminderError: null,
          },
          select: {
            id: true,
            electionId: true,
            studentIdentifier: true,
            studentName: true,
            studentClass: true,
            studentEmail: true,
            voterType: true,
            emailSentAt: true,
            emailError: true,
            reminderSentAt: true,
            reminderError: true,
            usedAt: true,
            createdAt: true,
          },
        });

        await auditService.writeLog(
          {
            actorId: input.actorId,
            action: "TOKEN_EMAIL_UPDATED",
            targetType: "voting_token",
            targetId: token.id,
            result: "SUCCESS",
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            metadata: {
              electionId: token.electionId,
              deliveryStatusReset: Boolean(token.emailSentAt || token.studentEmail),
            },
          },
          tx,
        );

        return record;
      });

      const sheetsSync = googleSheetsService.enabled
        ? await googleSheetsService.syncElection(token.electionId)
        : null;

      return { token: updated, sheetsSync };
    } finally {
      this.activeEmailDeliveries.delete(token.electionId);
    }
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
        const emailResults = students
          ? students.map((student) => ({
              status: student.studentEmail ? ("PENDING" as const) : ("SKIPPED" as const),
              error: student.studentEmail ? null : "Email pemilih kosong.",
            }))
          : undefined;
        if (students) {
          await this.syncTokensToSheet(input.electionId, election.title, hashes);
        }
        const sheetsSync = await this.getSheetsSyncStatus(input.electionId, Boolean(students));

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
                sent: 0,
                failed: 0,
                skipped: emailResults.filter((result) => result.status === "SKIPPED").length,
                pending: emailResults.filter((result) => result.status === "PENDING").length,
              }
            : undefined,
          sheetsSync,
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
        select: { id: true, title: true, status: true, mode: true },
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

      validateAssignmentsForElection(election.mode, input.students, input.count);

      if (input.students) {
        const identifiers = input.students
          .map((student) => student.studentIdentifier)
          .filter((value): value is string => Boolean(value));
        const emails = input.students
          .map((student) => student.studentEmail)
          .filter((value): value is string => Boolean(value));
        const existingAssignedTokens = await tx.votingToken.findMany({
          where: {
            electionId: input.electionId,
            OR: [
              ...(identifiers.length ? [{ studentIdentifier: { in: identifiers } }] : []),
              ...(emails.length ? [{ studentEmail: { in: emails } }] : []),
            ],
          },
          select: {
            studentIdentifier: true,
            studentEmail: true,
          },
        });

        if (existingAssignedTokens.length > 0) {
          throw new ServiceError(
            "TOKEN_STUDENT_ALREADY_ASSIGNED",
            `Token untuk pemilih ${existingAssignedTokens
              .map((token) => token.studentIdentifier ?? token.studentEmail)
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

  async retryFailedTokenEmails(input: {
    electionId: string;
    mode: "PENDING" | "FAILED" | "RESEND";
    tokenId?: string | undefined;
    actorId: string;
    actorRole: "ADMIN" | "SUPER_ADMIN";
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    if (this.activeEmailDeliveries.has(input.electionId)) {
      throw new ServiceError(
        "TOKEN_EMAIL_DELIVERY_BUSY",
        "Pengiriman email untuk election ini sedang berjalan. Tunggu batch aktif selesai.",
        409,
      );
    }
    this.activeEmailDeliveries.add(input.electionId);

    try {
      return await this.deliverTokenEmailBatch(input);
    } finally {
      this.activeEmailDeliveries.delete(input.electionId);
    }
  }

  private async deliverTokenEmailBatch(input: {
    electionId: string;
    mode: "PENDING" | "FAILED" | "RESEND";
    tokenId?: string | undefined;
    actorId: string;
    actorRole: "ADMIN" | "SUPER_ADMIN";
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const election = await prisma.election.findUnique({
      where: { id: input.electionId },
      select: {
        id: true,
        title: true,
        status: true,
        tokenEmailSubject: true,
        tokenEmailMessage: true,
      },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    if (["CLOSED", "ARCHIVED"].includes(election.status)) {
      throw new ServiceError(
        "ELECTION_WRONG_STATE",
        "Email token tidak dapat dikirim setelah election ditutup atau diarsipkan.",
        422,
      );
    }

    const baseDeliveryWhere: Prisma.VotingTokenWhereInput = {
      electionId: input.electionId,
      usedAt: null,
      studentEmail: { not: null },
      tokenCiphertext: { not: null },
    };
    let deliveryWhere: Prisma.VotingTokenWhereInput;
    if (input.mode === "RESEND") {
      if (!input.tokenId) {
        throw new ServiceError(
          "TOKEN_EMAIL_RESEND_UNAVAILABLE",
          "ID token wajib diisi untuk pengiriman ulang.",
          422,
        );
      }
      deliveryWhere = { ...baseDeliveryWhere, id: input.tokenId };
    } else {
      deliveryWhere = {
        ...baseDeliveryWhere,
        emailSentAt: null,
        emailError: input.mode === "PENDING" ? null : { not: null },
      };
    }
    const retryableTokens = await prisma.votingToken.findMany({
      where: deliveryWhere,
      orderBy: { createdAt: "asc" },
      take: input.mode === "RESEND" ? 1 : config.mail.deliveryBatchSize,
      select: {
        id: true,
        tokenCiphertext: true,
        studentIdentifier: true,
        studentName: true,
        studentEmail: true,
      },
    });

    if (input.mode === "RESEND" && retryableTokens.length === 0) {
      throw new ServiceError(
        "TOKEN_EMAIL_RESEND_UNAVAILABLE",
        "Token tidak dapat dikirim ulang karena sudah dipakai atau data emailnya tidak tersedia.",
        422,
      );
    }

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
        await prisma.votingToken.update({
          where: { id: tokenRecord.id },
          data: { emailError: "Token terenkripsi tidak dapat dibuka untuk retry." },
        });
        continue;
      }

      await delayBeforeEmail(emailSendIndex);
      emailSendIndex += 1;

      const result = await emailService.sendVotingToken({
        to: tokenRecord.studentEmail,
        studentName: tokenRecord.studentName ?? tokenRecord.studentIdentifier ?? "Pemilih",
        studentIdentifier: tokenRecord.studentIdentifier ?? null,
        electionTitle,
        token: plaintextToken,
        voteUrl: buildTokenVoteUrl(plaintextToken),
        subjectTemplate: election.tokenEmailSubject,
        messageTemplate: election.tokenEmailMessage,
      });

      await prisma.votingToken.update({
        where: { id: tokenRecord.id },
        data: {
          ...(result.ok
            ? { emailSentAt: new Date() }
            : input.mode === "RESEND"
              ? {}
              : { emailSentAt: null }),
          emailError: result.ok ? null : (result.error ?? "Gagal mengirim email."),
        },
      });

      if (result.ok) {
        sent += 1;
      } else if (result.skipped) {
        skipped += 1;
      } else {
        failed += 1;
      }
    }

    const remaining =
      input.mode === "RESEND" ? 0 : await prisma.votingToken.count({ where: deliveryWhere });
    if (remaining === 0 && googleSheetsService.enabled) {
      await googleSheetsService.syncElection(input.electionId);
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
        mode: input.mode,
        tokenId: input.tokenId,
        batchSize: config.mail.deliveryBatchSize,
        attempted: retryableTokens.length,
        sent,
        failed,
        skipped,
        remaining,
      },
    });

    return {
      attempted: retryableTokens.length,
      sent,
      failed,
      skipped,
      remaining,
    };
  }

  async prepareElectionReminders(input: {
    electionId: string;
    mode: "PENDING" | "FAILED" | "RESEND_UNUSED";
    actorRole: "ADMIN" | "SUPER_ADMIN";
  }) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    const election = await prisma.election.findUnique({
      where: { id: input.electionId },
      select: { status: true, reminderQueuedAt: true },
    });
    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }
    if (election.status !== "OPEN") {
      throw new ServiceError(
        "ELECTION_NOT_OPEN",
        "Reminder hanya dapat dikirim saat election berstatus OPEN.",
        422,
      );
    }

    if (input.mode === "RESEND_UNUSED" && this.activeReminderDeliveries.has(input.electionId)) {
      throw new ServiceError(
        "TOKEN_EMAIL_DELIVERY_BUSY",
        "Tunggu pengiriman reminder yang sedang berjalan selesai sebelum mengirim ulang.",
        409,
      );
    }

    if (input.mode === "RESEND_UNUSED") {
      const reminderQueuedAt = new Date();
      const reset = await prisma.$transaction(async (tx) => {
        const eligible = await tx.votingToken.updateMany({
          where: reminderEligibleWhere(input.electionId, reminderQueuedAt),
          data: {
            reminderSentAt: null,
            reminderError: null,
          },
        });

        await tx.election.update({
          where: { id: input.electionId },
          data: {
            reminderQueuedAt,
            reminderCompletedAt: null,
          },
        });

        return eligible.count;
      });

      return {
        pending: reset,
        alreadyRunning: false,
        resendCycle: true,
      };
    }

    if (input.mode === "FAILED") {
      await prisma.votingToken.updateMany({
        where: {
          electionId: input.electionId,
          usedAt: null,
          emailSentAt: { not: null },
          studentEmail: { not: null },
          tokenCiphertext: { not: null },
          reminderSentAt: null,
          reminderError: { not: null },
        },
        data: { reminderError: null },
      });
    }

    const reminderQueuedAt = election.reminderQueuedAt ?? new Date();
    await prisma.election.update({
      where: { id: input.electionId },
      data: {
        ...(!election.reminderQueuedAt ? { reminderQueuedAt } : {}),
        reminderCompletedAt: null,
      },
    });

    return {
      pending: await this.countPendingReminders(input.electionId, reminderQueuedAt),
      alreadyRunning: this.activeReminderDeliveries.has(input.electionId),
      resendCycle: false,
    };
  }

  async deliverElectionReminderQueue(input: {
    electionId: string;
    actorId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    if (this.activeReminderDeliveries.has(input.electionId)) {
      return { started: false, reason: "already_running" as const };
    }
    this.activeReminderDeliveries.add(input.electionId);

    let sent = 0;
    let failed = 0;
    try {
      while (true) {
        const batch = await this.deliverElectionReminderBatch(input);
        sent += batch.sent;
        failed += batch.failed;
        if (batch.remaining === 0 || batch.attempted === 0 || batch.stopped) {
          return { started: true, sent, failed, remaining: batch.remaining };
        }
      }
    } finally {
      this.activeReminderDeliveries.delete(input.electionId);
    }
  }

  private async deliverElectionReminderBatch(input: {
    electionId: string;
    actorId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const election = await prisma.election.findUnique({
      where: { id: input.electionId },
      select: {
        id: true,
        title: true,
        status: true,
        reminderQueuedAt: true,
        reminderEmailSubject: true,
        reminderEmailMessage: true,
      },
    });
    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }
    if (election.status !== "OPEN") {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        remaining: election.reminderQueuedAt
          ? await this.countPendingReminders(input.electionId, election.reminderQueuedAt)
          : 0,
        stopped: true,
      };
    }
    if (!election.reminderQueuedAt) {
      return { attempted: 0, sent: 0, failed: 0, remaining: 0, stopped: true };
    }

    const reminderTokens = await prisma.votingToken.findMany({
      where: reminderPendingWhere(input.electionId, election.reminderQueuedAt),
      orderBy: { createdAt: "asc" },
      take: config.mail.deliveryBatchSize,
      select: {
        id: true,
        tokenCiphertext: true,
        studentIdentifier: true,
        studentName: true,
        studentEmail: true,
      },
    });

    let sent = 0;
    let failed = 0;
    let emailSendIndex = 0;
    for (const tokenRecord of reminderTokens) {
      if (!tokenRecord.studentEmail || !tokenRecord.tokenCiphertext) {
        failed += 1;
        await prisma.votingToken.update({
          where: { id: tokenRecord.id },
          data: { reminderError: "Data email atau token reminder tidak lengkap." },
        });
        continue;
      }

      let plaintextToken: string;
      try {
        plaintextToken = decryptTokenPlaintext(tokenRecord.tokenCiphertext);
      } catch {
        failed += 1;
        await prisma.votingToken.update({
          where: { id: tokenRecord.id },
          data: { reminderError: "Token terenkripsi tidak dapat dibuka untuk reminder." },
        });
        continue;
      }

      await delayBeforeEmail(emailSendIndex);
      emailSendIndex += 1;
      const stillEligible = await prisma.votingToken.count({
        where: {
          ...reminderPendingWhere(input.electionId, election.reminderQueuedAt),
          id: tokenRecord.id,
        },
      });
      if (stillEligible === 0) {
        continue;
      }
      const result = await emailService.sendVotingToken({
        to: tokenRecord.studentEmail,
        studentName: tokenRecord.studentName ?? tokenRecord.studentIdentifier ?? "Pemilih",
        studentIdentifier: tokenRecord.studentIdentifier,
        electionTitle: election.title,
        token: plaintextToken,
        voteUrl: buildTokenVoteUrl(plaintextToken),
        kind: "REMINDER",
        subjectTemplate: election.reminderEmailSubject,
        messageTemplate: election.reminderEmailMessage,
      });

      await prisma.votingToken.update({
        where: { id: tokenRecord.id },
        data: {
          reminderSentAt: result.ok ? new Date() : null,
          reminderError: result.ok ? null : (result.error ?? "Gagal mengirim reminder."),
        },
      });
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    const remaining = await this.countPendingReminders(input.electionId, election.reminderQueuedAt);
    if (remaining === 0) {
      await prisma.election.update({
        where: { id: input.electionId },
        data: { reminderCompletedAt: new Date() },
      });
    }

    await auditService.writeLog({
      actorId: input.actorId,
      action: "TOKEN_REMINDER_SENT",
      targetType: "election",
      targetId: input.electionId,
      result: "SUCCESS",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        reminderQueuedAt: election.reminderQueuedAt.toISOString(),
        batchSize: config.mail.deliveryBatchSize,
        attempted: reminderTokens.length,
        sent,
        failed,
        remaining,
      },
    });

    return {
      attempted: reminderTokens.length,
      sent,
      failed,
      remaining,
      stopped: false,
    };
  }

  private countPendingReminders(electionId: string, queuedAt: Date) {
    return prisma.votingToken.count({ where: reminderPendingWhere(electionId, queuedAt) });
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

  private async getSheetsSyncStatus(electionId: string, requested: boolean) {
    if (!requested) {
      return {
        status: "DISABLED" as const,
        spreadsheetUrl: null,
        error: "Sync Sheets hanya berlaku untuk token yang diimport per pemilih.",
      };
    }
    if (!googleSheetsService.enabled) {
      return {
        status: "DISABLED" as const,
        spreadsheetUrl: null,
        error: "Google Sheets belum diaktifkan di environment deployment.",
      };
    }

    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        googleSheetsSpreadsheetId: true,
        googleSheetsSyncError: true,
      },
    });
    const spreadsheetId = election?.googleSheetsSpreadsheetId ?? null;
    return {
      status: election?.googleSheetsSyncError ? ("FAILED" as const) : ("SYNCED" as const),
      spreadsheetUrl: spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}`
        : null,
      error: election?.googleSheetsSyncError ?? null,
    };
  }
}

function buildTokenVoteUrl(token: string) {
  const url = new URL("/vote", config.app.publicUrl.replace(/\/$/, ""));
  url.searchParams.set("token", token);
  return url.toString();
}

function reminderPendingWhere(electionId: string, queuedAt: Date): Prisma.VotingTokenWhereInput {
  return {
    ...reminderEligibleWhere(electionId, queuedAt),
    reminderSentAt: null,
    reminderError: null,
  };
}

function reminderEligibleWhere(electionId: string, queuedAt: Date): Prisma.VotingTokenWhereInput {
  return {
    electionId,
    usedAt: null,
    emailSentAt: { not: null, lte: queuedAt },
    studentEmail: { not: null },
    tokenCiphertext: { not: null },
  };
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
    studentIdentifier: student.studentIdentifier?.trim().toUpperCase() || null,
    studentName: student.studentName.trim(),
    studentClass: student.studentClass?.trim() || null,
    studentEmail: student.studentEmail?.trim().toLowerCase() || null,
    voterType: student.voterType ?? "STUDENT",
  }));

  const identifiers = new Set<string>();
  const emails = new Set<string>();
  for (const student of normalized) {
    if (student.studentIdentifier && identifiers.has(student.studentIdentifier)) {
      throw new ServiceError(
        "TOKEN_STUDENT_DUPLICATE",
        "NIS/ID siswa tidak boleh duplikat dalam satu batch.",
        422,
      );
    }
    if (student.studentIdentifier) {
      identifiers.add(student.studentIdentifier);
    }
    if (student.studentEmail && emails.has(student.studentEmail)) {
      throw new ServiceError(
        "TOKEN_STUDENT_DUPLICATE",
        "Email pemilih tidak boleh duplikat dalam satu batch.",
        422,
      );
    }
    if (student.studentEmail) {
      emails.add(student.studentEmail);
    }
  }

  return normalized;
}

function validateAssignmentsForElection(
  mode: "STANDARD" | "WEIGHTED_FIVE",
  students: TokenStudentAssignmentInput[] | undefined,
  count: number,
) {
  if (mode === "WEIGHTED_FIVE" && !students) {
    throw new ServiceError(
      "WEIGHTED_ELECTION_REQUIRES_VOTERS",
      "Mode 5 kandidat berbobot harus memakai import pemilih agar role suara dapat dihitung.",
      422,
    );
  }

  for (const [index, student] of (students ?? []).entries()) {
    const row = index + 1;
    if (mode === "STANDARD") {
      if (!student.studentIdentifier) {
        throw new ServiceError(
          "TOKEN_STUDENT_IDENTIFIER_REQUIRED",
          `Baris ${row}: NIS/ID wajib diisi untuk election biasa.`,
          422,
        );
      }
      if (!student.voterType || !["STUDENT", "TEACHER"].includes(student.voterType)) {
        throw new ServiceError(
          "TOKEN_VOTER_TYPE_INVALID",
          `Baris ${row}: role election biasa harus SISWA atau GURU.`,
          422,
        );
      }
      continue;
    }

    if (!student.voterType || !["OSIS", "MPK", "GURU"].includes(student.voterType)) {
      throw new ServiceError(
        "TOKEN_VOTER_TYPE_INVALID",
        `Baris ${row}: role harus OSIS, MPK, atau GURU.`,
        422,
      );
    }
    if (!student.studentEmail) {
      throw new ServiceError(
        "TOKEN_STUDENT_EMAIL_REQUIRED",
        `Baris ${row}: email wajib diisi karena mode berbobot tidak menggunakan NIS/ID.`,
        422,
      );
    }
    if (student.voterType !== "GURU" && !student.studentClass) {
      throw new ServiceError(
        "TOKEN_STUDENT_CLASS_REQUIRED",
        `Baris ${row}: kelas wajib diisi untuk role ${student.voterType}.`,
        422,
      );
    }
    if (student.voterType === "GURU") {
      student.studentClass = null;
    }
    student.studentIdentifier = null;
  }

  if (count < 1) {
    throw new ServiceError("TOKEN_GENERATION_FAILED", "Daftar pemilih kosong.", 422);
  }
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
