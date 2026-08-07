import { z } from "zod";

import { MAX_TOKEN_BATCH_SIZE } from "@/config/tokens";

export const idSchema = z.string().trim().min(1).max(100);
export const cuidSchema = idSchema;
export const tokenSchema = z.string().trim().min(8).max(64);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: cuidSchema,
});

export const electionIdQuerySchema = z.object({
  electionId: cuidSchema,
});

export const electionIdBodySchema = z.object({
  electionId: cuidSchema,
});

export const validateTokenSchema = z.object({
  token: tokenSchema,
});

export const castVoteSchema = z.object({
  token: tokenSchema,
  candidateId: cuidSchema,
  electionId: cuidSchema,
});

export const createElectionSchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const electionStatusSchema = z.enum([
  "SETUP",
  "READY",
  "OPEN",
  "PAUSED",
  "CLOSED",
  "ARCHIVED",
]);
export const electionTransitionStatusSchema = electionStatusSchema.exclude(["SETUP"]);

export const updateElectionStatusSchema = z.object({
  status: electionTransitionStatusSchema,
});

export const candidateCreateSchema = z.object({
  electionId: cuidSchema,
  orderNumber: z.number().int().min(1).max(5),
  name: z.string().trim().min(2).max(255),
  className: z.string().trim().min(1).max(50),
  vision: z.string().trim().min(10).max(1000),
  missions: z.array(z.string().trim().min(5).max(500)).min(1).max(10),
});

export const candidateUpdateSchema = candidateCreateSchema
  .omit({ electionId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field harus dikirim.",
  });

export const tokenStudentSchema = z.object({
  studentIdentifier: z.string().trim().min(1).max(100),
  studentName: z.string().trim().min(1).max(255),
  studentClass: z.string().trim().max(100).optional(),
  studentEmail: z.string().trim().email().max(255).optional(),
  voterType: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
});

export const tokenGenerateSchema = z
  .object({
    electionId: cuidSchema,
    count: z.number().int().min(1).max(MAX_TOKEN_BATCH_SIZE).optional(),
    students: z.array(tokenStudentSchema).min(1).max(MAX_TOKEN_BATCH_SIZE).optional(),
  })
  .superRefine((value, context) => {
    if (!value.count && !value.students) {
      context.addIssue({
        code: "custom",
        message: "Isi count atau daftar siswa.",
        path: ["count"],
      });
    }

    if (value.count && value.students) {
      context.addIssue({
        code: "custom",
        message: "Pilih salah satu: count atau daftar siswa.",
        path: ["students"],
      });
    }

    if (value.students) {
      const identifiers = new Set<string>();
      for (const [index, student] of value.students.entries()) {
        const normalizedIdentifier = student.studentIdentifier.trim().toUpperCase();
        if (identifiers.has(normalizedIdentifier)) {
          context.addIssue({
            code: "custom",
            message: "NIS/ID siswa tidak boleh duplikat dalam satu batch.",
            path: ["students", index, "studentIdentifier"],
          });
        }
        identifiers.add(normalizedIdentifier);
      }
    }
  });

export const adminRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]);

export const adminListQuerySchema = paginationQuerySchema.extend({
  "filterBy[role]": adminRoleSchema.optional(),
  "filterBy[isActive]": z.coerce.boolean().optional(),
});

export const createAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{3,50}$/),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  role: adminRoleSchema,
});

export const updateAdminSchema = z
  .object({
    email: z.string().email().max(255).optional(),
    password: z.string().min(8).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).optional(),
    role: adminRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field harus dikirim.",
  });

export const auditResultSchema = z.enum(["SUCCESS", "FAILURE"]);

export const auditActionSchema = z.enum([
  "ADMIN_CREATED",
  "ADMIN_UPDATED",
  "ADMIN_DEACTIVATED",
  "ADMIN_PASSWORD_CHANGED",
  "ADMIN_LOGIN_SUCCESS",
  "ADMIN_LOGIN_FAILED",
  "ELECTION_CREATED",
  "ELECTION_STATUS_CHANGED",
  "ELECTION_DELETED",
  "CANDIDATE_CREATED",
  "CANDIDATE_UPDATED",
  "CANDIDATE_DELETED",
  "TOKEN_BATCH_GENERATED",
  "TOKEN_BATCH_EXPORTED",
  "TOKEN_EMAIL_RETRIED",
  "VOTE_CAST",
  "BACKUP_RESTORED",
]);

export const auditQuerySchema = paginationQuerySchema.extend({
  "filterBy[action]": auditActionSchema.optional(),
  "filterBy[result]": auditResultSchema.optional(),
  "filterBy[actorId]": cuidSchema.optional(),
  "filterBy[targetType]": z.string().trim().min(1).max(50).optional(),
  "filterBy[targetId]": z.string().trim().min(1).max(100).optional(),
  "filterBy[createdFrom]": z.coerce.date().optional(),
  "filterBy[createdTo]": z.coerce.date().optional(),
});
