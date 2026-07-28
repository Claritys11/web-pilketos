import { z } from "zod";

export const cuidSchema = z.string().cuid();
export const tokenSchema = z.string().trim().min(8).max(64);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const electionIdQuerySchema = z.object({
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

export const tokenGenerateSchema = z.object({
  electionId: cuidSchema,
  count: z.number().int().min(1).max(1000),
});

export const adminRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]);

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
