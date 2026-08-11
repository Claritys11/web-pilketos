import type { AdminRole, Prisma } from "@prisma/client";

import { hashPassword, verifyPassword } from "@/lib/auth/argon";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { assertRole, ServiceError } from "@/services/errors";
import type { ActorContext } from "@/services/election.service";

export interface CreateAdminInput extends ActorContext {
  username: string;
  email: string;
  password: string;
  role: AdminRole;
}

export interface UpdateAdminInput extends ActorContext {
  id: string;
  email?: string | undefined;
  password?: string | undefined;
  role?: AdminRole | undefined;
  isActive?: boolean | undefined;
}

export interface ChangeOwnPasswordInput extends ActorContext {
  currentPassword: string;
  newPassword: string;
}

export class AdminService {
  async listAdmins(
    params: {
      page?: number;
      pageSize?: number;
      role?: AdminRole | undefined;
      isActive?: boolean | undefined;
    } = {},
  ) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const where: Prisma.AdminWhereInput = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.admin.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.admin.count({ where }),
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

  async createAdmin(input: CreateAdminInput) {
    assertRole(input.actorRole, ["SUPER_ADMIN"]);

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findFirst({
        where: {
          OR: [{ username: input.username }, { email: input.email }],
        },
        select: { username: true, email: true },
      });

      if (existing?.username === input.username) {
        throw new ServiceError("ADMIN_USERNAME_TAKEN", "Username sudah digunakan.", 409);
      }

      if (existing?.email === input.email) {
        throw new ServiceError("ADMIN_EMAIL_TAKEN", "Email sudah digunakan.", 409);
      }

      const admin = await tx.admin.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash,
          role: input.role,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: "ADMIN_CREATED",
          targetType: "admin",
          targetId: admin.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            username: input.username,
            role: input.role,
          },
        },
        tx,
      );

      return admin;
    });
  }

  async updateAdmin(input: UpdateAdminInput) {
    assertRole(input.actorRole, ["SUPER_ADMIN"]);

    if (input.id === input.actorId && input.isActive === false) {
      throw new ServiceError(
        "CANNOT_DEACTIVATE_SELF",
        "Super Admin tidak dapat menonaktifkan dirinya sendiri.",
        422,
      );
    }

    const passwordHash = input.password ? await hashPassword(input.password) : undefined;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!existing) {
        throw new ServiceError("ADMIN_NOT_FOUND", "Admin tidak ditemukan.", 404);
      }

      if (input.email) {
        const emailTaken = await tx.admin.findFirst({
          where: {
            email: input.email,
            id: { not: input.id },
          },
          select: { id: true },
        });

        if (emailTaken) {
          throw new ServiceError("ADMIN_EMAIL_TAKEN", "Email sudah digunakan.", 409);
        }
      }

      const data: Prisma.AdminUpdateInput = {
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      };

      const admin = await tx.admin.update({
        where: { id: input.id },
        data,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await auditService.writeLog(
        {
          actorId: input.actorId,
          action: input.isActive === false ? "ADMIN_DEACTIVATED" : "ADMIN_UPDATED",
          targetType: "admin",
          targetId: input.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            changedFields: Object.keys(data),
          },
        },
        tx,
      );

      return admin;
    });
  }

  async changeOwnPassword(input: ChangeOwnPasswordInput) {
    assertRole(input.actorRole, ["SUPER_ADMIN"]);

    const admin = await prisma.admin.findUnique({
      where: { id: input.actorId },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!admin?.isActive) {
      throw new ServiceError("ADMIN_NOT_FOUND", "Akun Super Admin tidak ditemukan.", 404);
    }

    if (!(await verifyPassword(admin.passwordHash, input.currentPassword))) {
      throw new ServiceError("CURRENT_PASSWORD_INVALID", "Password saat ini tidak sesuai.", 422);
    }

    if (await verifyPassword(admin.passwordHash, input.newPassword)) {
      throw new ServiceError(
        "PASSWORD_REUSE_NOT_ALLOWED",
        "Password baru harus berbeda dari password saat ini.",
        422,
      );
    }

    const passwordHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { id: admin.id },
        data: { passwordHash },
      });

      await auditService.writeLog(
        {
          actorId: admin.id,
          action: "ADMIN_PASSWORD_CHANGED",
          targetType: "admin",
          targetId: admin.id,
          result: "SUCCESS",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: { changedBySelf: true },
        },
        tx,
      );
    });

    return { changed: true };
  }
}

export const adminService = new AdminService();
