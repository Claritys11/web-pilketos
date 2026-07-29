import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createStorageCuid } from "@/lib/security/upload";
import { storageService } from "@/lib/storage";
import { auditService } from "@/services/audit.service";
import { assertRole, ServiceError } from "@/services/errors";
import type { ActorContext } from "@/services/election.service";

export interface CandidateInput {
  electionId: string;
  orderNumber: number;
  name: string;
  className: string;
  vision: string;
  missions: string[];
}

export interface UpdateCandidateInput extends ActorContext {
  id: string;
  orderNumber?: number | undefined;
  name?: string | undefined;
  className?: string | undefined;
  vision?: string | undefined;
  missions?: string[] | undefined;
}

export class CandidateService {
  async listPublicCandidates(electionId: string) {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: { id: true, status: true },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    if (election.status !== "OPEN") {
      throw new ServiceError("ELECTION_NOT_OPEN", "Voting sedang tidak berlangsung.", 422);
    }

    return prisma.candidate.findMany({
      where: { electionId },
      orderBy: { orderNumber: "asc" },
      select: {
        id: true,
        electionId: true,
        orderNumber: true,
        name: true,
        className: true,
        vision: true,
        missions: true,
        photoUrl: true,
      },
    });
  }

  async listCandidates(electionId: string) {
    return prisma.candidate.findMany({
      where: { electionId },
      orderBy: { orderNumber: "asc" },
    });
  }

  private async assertElectionEditable(electionId: string, tx: Prisma.TransactionClient = prisma) {
    const election = await tx.election.findUnique({
      where: { id: electionId },
      select: { id: true, status: true },
    });

    if (!election) {
      throw new ServiceError("ELECTION_NOT_FOUND", "Election tidak ditemukan.", 404);
    }

    if (election.status !== "SETUP") {
      throw new ServiceError(
        "ELECTION_WRONG_STATE",
        "Kandidat hanya bisa diubah saat election SETUP.",
        422,
      );
    }
  }

  async createCandidate(input: ActorContext & CandidateInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    return prisma.$transaction(async (tx) => {
      await this.assertElectionEditable(input.electionId, tx);

      const candidateCount = await tx.candidate.count({
        where: { electionId: input.electionId },
      });
      if (candidateCount >= 5) {
        throw new ServiceError(
          "ELECTION_MAX_CANDIDATES",
          "Election sudah memiliki 5 kandidat.",
          422,
        );
      }

      const orderTaken = await tx.candidate.findUnique({
        where: {
          electionId_orderNumber: {
            electionId: input.electionId,
            orderNumber: input.orderNumber,
          },
        },
        select: { id: true },
      });

      if (orderTaken) {
        throw new ServiceError("ORDER_NUMBER_TAKEN", "Nomor urut sudah digunakan.", 409);
      }

      const candidate = await tx.candidate.create({
        data: {
          electionId: input.electionId,
          orderNumber: input.orderNumber,
          name: input.name,
          className: input.className,
          vision: input.vision,
          missions: input.missions,
        },
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "CANDIDATE_CREATED",
          targetType: "candidate",
          targetId: candidate.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            name: input.name,
            orderNumber: input.orderNumber,
            electionId: input.electionId,
          },
        },
        tx,
      );

      return candidate;
    });
  }

  async updateCandidate(input: UpdateCandidateInput) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.candidate.findUnique({
        where: { id: input.id },
        select: { id: true, electionId: true },
      });

      if (!existing) {
        throw new ServiceError("CANDIDATE_NOT_FOUND", "Kandidat tidak ditemukan.", 404);
      }

      await this.assertElectionEditable(existing.electionId, tx);

      if (input.orderNumber !== undefined) {
        const orderTaken = await tx.candidate.findFirst({
          where: {
            electionId: existing.electionId,
            orderNumber: input.orderNumber,
            id: { not: input.id },
          },
          select: { id: true },
        });

        if (orderTaken) {
          throw new ServiceError("ORDER_NUMBER_TAKEN", "Nomor urut sudah digunakan.", 409);
        }
      }

      const data: Prisma.CandidateUpdateInput = {
        ...(input.orderNumber !== undefined ? { orderNumber: input.orderNumber } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.className !== undefined ? { className: input.className } : {}),
        ...(input.vision !== undefined ? { vision: input.vision } : {}),
        ...(input.missions !== undefined ? { missions: input.missions } : {}),
      };

      const candidate = await tx.candidate.update({
        where: { id: input.id },
        data,
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "CANDIDATE_UPDATED",
          targetType: "candidate",
          targetId: candidate.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            changedFields: Object.keys(data),
          },
        },
        tx,
      );

      return candidate;
    });
  }

  async deleteCandidate(input: ActorContext & { id: string }) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    return prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findUnique({
        where: { id: input.id },
        include: {
          _count: { select: { votes: true } },
        },
      });

      if (!candidate) {
        throw new ServiceError("CANDIDATE_NOT_FOUND", "Kandidat tidak ditemukan.", 404);
      }

      await this.assertElectionEditable(candidate.electionId, tx);

      if (candidate._count.votes > 0) {
        throw new ServiceError(
          "CANDIDATE_HAS_VOTES",
          "Kandidat tidak bisa dihapus karena sudah memiliki suara.",
          409,
        );
      }

      await tx.candidate.delete({ where: { id: input.id } });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "CANDIDATE_DELETED",
          targetType: "candidate",
          targetId: input.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            name: candidate.name,
            orderNumber: candidate.orderNumber,
          },
        },
        tx,
      );

      return { deletedId: input.id };
    });
  }

  async uploadPhoto(
    input: ActorContext & {
      id: string;
      buffer: Buffer | Uint8Array;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
      extension: "jpg" | "jpeg" | "png" | "webp";
    },
  ) {
    assertRole(input.actorRole, ["ADMIN", "SUPER_ADMIN"]);

    const candidate = await prisma.candidate.findUnique({
      where: { id: input.id },
      select: { id: true, electionId: true, photoUrl: true },
    });

    if (!candidate) {
      throw new ServiceError("CANDIDATE_NOT_FOUND", "Kandidat tidak ditemukan.", 404);
    }

    await this.assertElectionEditable(candidate.electionId);

    const storagePath = `candidates/${candidate.id}/${createStorageCuid()}.${input.extension}`;
    const photoUrl = await storageService.uploadFile(storagePath, input.buffer, input.mimeType);

    const updated = await prisma.candidate.update({
      where: { id: input.id },
      data: { photoUrl },
    });

    await auditService.writeLog({
      actorId: input.actorId,
      action: "CANDIDATE_UPDATED",
      targetType: "candidate",
      targetId: input.id,
      result: "SUCCESS",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        changedFields: ["photoUrl"],
        storagePath,
      },
    });

    return updated;
  }
}

export const candidateService = new CandidateService();
