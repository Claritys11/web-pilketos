import type { ElectionMode, ElectionStatus, Prisma, VoterType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { assertRole, ServiceError } from "@/services/errors";

const ALLOWED_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  SETUP: ["READY"],
  READY: ["OPEN"],
  OPEN: ["PAUSED", "CLOSED"],
  PAUSED: ["OPEN", "CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export interface ActorContext {
  actorId: string;
  actorRole: "VIEWER" | "ADMIN" | "SUPER_ADMIN";
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface CreateElectionInput extends ActorContext {
  title: string;
  description?: string | null | undefined;
  mode: ElectionMode;
}

const WEIGHTED_ROLE_WEIGHTS: Record<"OSIS" | "MPK" | "GURU", number> = {
  OSIS: 40,
  MPK: 30,
  GURU: 30,
};

export interface UpdateElectionInput extends ActorContext {
  id: string;
  title?: string | undefined;
  description?: string | null | undefined;
}

export interface UpdateElectionEmailTemplatesInput extends ActorContext {
  id: string;
  tokenEmailSubject: string;
  tokenEmailMessage: string;
  reminderEmailSubject: string;
  reminderEmailMessage: string;
  includeVoteLink?: boolean | undefined;
  includeWhatsappSupport?: boolean | undefined;
}

export class ElectionService {
  async getDashboardStats(electionId: string) {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: {
          orderBy: { orderNumber: "asc" },
          select: {
            id: true,
            orderNumber: true,
            name: true,
          },
        },
        _count: {
          select: {
            votes: true,
            tokens: true,
          },
        },
      },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    const [usedTokens, lastVote, groupedVotes] = await prisma.$transaction([
      prisma.votingToken.count({ where: { electionId, usedAt: { not: null } } }),
      prisma.vote.findFirst({
        where: { electionId },
        orderBy: { votedAt: "desc" },
        select: { votedAt: true },
      }),
      prisma.vote.groupBy({
        by: ["candidateId", "voterType"],
        where: { electionId },
        orderBy: { candidateId: "asc" },
        _count: { candidateId: true },
      }),
    ]);

    const voteMap = new Map<string, number>();
    const roleVoteMap = new Map<string, number>();
    const roleTotals = new Map<VoterType, number>();
    for (const item of groupedVotes) {
      const count = typeof item._count === "object" ? (item._count.candidateId ?? 0) : 0;
      voteMap.set(item.candidateId, (voteMap.get(item.candidateId) ?? 0) + count);
      if (item.voterType) {
        roleVoteMap.set(`${item.candidateId}:${item.voterType}`, count);
        roleTotals.set(item.voterType, (roleTotals.get(item.voterType) ?? 0) + count);
      }
    }
    const totalVotes = election._count.votes;
    const totalTokens = election._count.tokens;

    return {
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
        mode: election.mode,
        openedAt: election.openedAt,
      },
      totalVotes,
      totalTokens,
      usedTokens,
      participationRate:
        totalTokens === 0 ? 0 : Number(((usedTokens / totalTokens) * 100).toFixed(1)),
      lastVoteAt: lastVote?.votedAt ?? null,
      candidateStats: election.candidates.map((candidate) => {
        const voteCount = voteMap.get(candidate.id) ?? 0;
        const roleBreakdown = (["OSIS", "MPK", "GURU"] as const).map((role) => {
          const roleVoteCount = roleVoteMap.get(`${candidate.id}:${role}`) ?? 0;
          const roleTotal = roleTotals.get(role) ?? 0;
          const rolePercentage =
            roleTotal === 0 ? 0 : Number(((roleVoteCount / roleTotal) * 100).toFixed(2));
          return {
            role,
            voteCount: roleVoteCount,
            totalVotes: roleTotal,
            percentage: rolePercentage,
            weight: WEIGHTED_ROLE_WEIGHTS[role],
          };
        });
        const weightedScore = Number(
          roleBreakdown
            .reduce((score, group) => score + (group.percentage * group.weight) / 100, 0)
            .toFixed(2),
        );
        return {
          candidateId: candidate.id,
          orderNumber: candidate.orderNumber,
          name: candidate.name,
          voteCount,
          percentage: totalVotes === 0 ? 0 : Number(((voteCount / totalVotes) * 100).toFixed(2)),
          weightedScore: election.mode === "WEIGHTED_FIVE" ? weightedScore : null,
          roleBreakdown: election.mode === "WEIGHTED_FIVE" ? roleBreakdown : [],
        };
      }),
      generatedAt: new Date(),
    };
  }

  async listElections(params: { page?: number; pageSize?: number; status?: ElectionStatus } = {}) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const where: Prisma.ElectionWhereInput = params.status ? { status: params.status } : {};
    const [items, total] = await prisma.$transaction([
      prisma.election.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, username: true } },
          _count: { select: { candidates: true, tokens: true } },
        },
      }),
      prisma.election.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getElection(id: string) {
    const election = await prisma.election.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true } },
        candidates: { orderBy: { orderNumber: "asc" } },
        _count: { select: { tokens: true, votes: true } },
      },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    const reminderEligibleWhere: Prisma.VotingTokenWhereInput = {
      electionId: id,
      usedAt: null,
      emailSentAt: { not: null },
      studentEmail: { not: null },
      tokenCiphertext: { not: null },
    };
    const reminderCycleWhere: Prisma.VotingTokenWhereInput = {
      ...reminderEligibleWhere,
      emailSentAt: election.reminderQueuedAt
        ? { not: null, lte: election.reminderQueuedAt }
        : { not: null },
    };
    const [eligible, pending, sent, failed] = await prisma.$transaction([
      prisma.votingToken.count({ where: reminderEligibleWhere }),
      prisma.votingToken.count({
        where: {
          ...reminderCycleWhere,
          reminderSentAt: null,
          reminderError: null,
        },
      }),
      prisma.votingToken.count({
        where: { ...reminderCycleWhere, reminderSentAt: { not: null } },
      }),
      prisma.votingToken.count({
        where: { ...reminderCycleWhere, reminderError: { not: null } },
      }),
    ]);

    return {
      ...election,
      reminderSummary: { eligible, pending, sent, failed },
    };
  }

  async getOpenElectionSummary() {
    return prisma.election.findFirst({
      where: { status: "OPEN" },
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        mode: true,
        openedAt: true,
      },
    });
  }

  async createElection(input: CreateElectionInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    return prisma.$transaction(async (tx) => {
      const election = await tx.election.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          mode: input.mode,
          createdById: input.actorId,
        },
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "ELECTION_CREATED",
          targetType: "election",
          targetId: election.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: { title: input.title, mode: input.mode },
        },
        tx,
      );

      return election;
    });
  }

  async updateElection(input: UpdateElectionInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    return prisma.election.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }

  async updateEmailTemplates(input: UpdateElectionEmailTemplatesInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    const election = await prisma.election.findUnique({
      where: { id: input.id },
      select: { status: true },
    });
    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }
    if (["CLOSED", "ARCHIVED"].includes(election.status)) {
      throw new ServiceError(
        "ELECTION_WRONG_STATE",
        "Template email tidak dapat diubah setelah election ditutup atau diarsipkan.",
        422,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.election.update({
        where: { id: input.id },
        data: {
          tokenEmailSubject: input.tokenEmailSubject,
          tokenEmailMessage: input.tokenEmailMessage,
          reminderEmailSubject: input.reminderEmailSubject,
          reminderEmailMessage: input.reminderEmailMessage,
          ...(input.includeVoteLink !== undefined ? { includeVoteLink: input.includeVoteLink } : {}),
          ...(input.includeWhatsappSupport !== undefined ? { includeWhatsappSupport: input.includeWhatsappSupport } : {}),
        },
      });
      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "ELECTION_EMAIL_TEMPLATE_UPDATED",
          targetType: "election",
          targetId: input.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
        tx,
      );
      return updated;
    });
  }

  async transitionStatus(input: ActorContext & { electionId: string; status: ElectionStatus }) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    return prisma.$transaction(async (tx) => {
      const election = await tx.election.findUnique({
        where: { id: input.electionId },
        include: {
          _count: {
            select: {
              candidates: true,
              tokens: true,
            },
          },
        },
      });

      if (!election) {
        throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
      }

      if (!ALLOWED_TRANSITIONS[election.status].includes(input.status)) {
        throw new ServiceError(
          "ELECTION_TRANSITION_INVALID",
          `Transisi ${election.status} ke ${input.status} tidak diizinkan.`,
          422,
        );
      }

      if (election.status === "SETUP" && input.status === "READY") {
        const requiredCandidates = election.mode === "WEIGHTED_FIVE" ? 5 : 2;
        if (
          election._count.candidates < requiredCandidates ||
          (election.mode === "WEIGHTED_FIVE" && election._count.candidates !== 5)
        ) {
          throw new ServiceError(
            "ELECTION_MIN_CANDIDATES",
            election.mode === "WEIGHTED_FIVE"
              ? "Mode 5 kandidat berbobot harus memiliki tepat 5 kandidat."
              : "Election harus memiliki minimal 2 kandidat.",
            422,
          );
        }

        if (election._count.tokens < 1) {
          throw new ServiceError("ELECTION_WRONG_STATE", "Election harus memiliki token.", 422);
        }

        if (election.mode === "WEIGHTED_FIVE") {
          const roleCounts = await tx.votingToken.groupBy({
            by: ["voterType"],
            where: { electionId: input.electionId },
            _count: { voterType: true },
          });
          const availableRoles = new Set(
            roleCounts.filter((item) => item._count.voterType > 0).map((item) => item.voterType),
          );
          const missingRoles = (["OSIS", "MPK", "GURU"] as const).filter(
            (role) => !availableRoles.has(role),
          );
          if (missingRoles.length > 0) {
            throw new ServiceError(
              "ELECTION_WRONG_STATE",
              `Token untuk role ${missingRoles.join(", ")} belum tersedia.`,
              422,
            );
          }
        }
      }

      if (input.status === "OPEN") {
        const activeElection = await tx.election.findFirst({
          where: {
            id: { not: input.electionId },
            status: { in: ["OPEN", "PAUSED"] },
          },
          select: { title: true, status: true },
        });

        if (activeElection) {
          throw new ServiceError(
            "ACTIVE_ELECTION_EXISTS",
            `Sudah ada election aktif: ${activeElection.title} (${activeElection.status}). Tutup election itu sebelum membuka election lain.`,
            422,
          );
        }
      }

      const updated = await tx.election.update({
        where: { id: input.electionId },
        data: {
          status: input.status,
          ...(input.status === "OPEN" && !election.openedAt ? { openedAt: new Date() } : {}),
          ...(input.status === "OPEN" && !election.openedAt
            ? { reminderQueuedAt: new Date(), reminderCompletedAt: null }
            : {}),
          ...(input.status === "CLOSED" ? { closedAt: new Date() } : {}),
        },
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "ELECTION_STATUS_CHANGED",
          targetType: "election",
          targetId: input.electionId,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: { from: election.status, to: input.status },
        },
        tx,
      );

      return updated;
    });
  }

  async deleteElection(input: ActorContext & { electionId: string }) {
    assertRole(input.actorRole, ["SUPER_ADMIN"]);

    const election = await prisma.election.findUnique({
      where: { id: input.electionId },
      select: { id: true, title: true, status: true },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    if (!["SETUP", "ARCHIVED"].includes(election.status)) {
      throw new ServiceError(
        "ELECTION_WRONG_STATE",
        "Election hanya bisa dihapus saat SETUP atau ARCHIVED.",
        422,
      );
    }

    await prisma.election.delete({ where: { id: input.electionId } });
    await auditService.writeLog({
      actorId: input.actorId,
      action: "ELECTION_DELETED",
      targetType: "election",
      targetId: input.electionId,
      result: "SUCCESS",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { title: election.title, status: election.status },
    });

    return { deletedId: input.electionId };
  }
}

export const electionService = new ElectionService();
