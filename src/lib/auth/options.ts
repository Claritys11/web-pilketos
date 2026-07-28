import type { NextAuthConfig, User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { config } from "@/config/env";
import { verifyPassword } from "@/lib/auth/argon";
import { writeAuthAuditLog } from "@/lib/auth/audit";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(128),
});

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")
  );
}

export const authOptions: NextAuthConfig = {
  trustHost: true,
  secret: config.auth.secret,
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request): Promise<User | null> {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          await writeAuthAuditLog({
            action: "ADMIN_LOGIN_FAILED",
            result: "FAILURE",
            request,
            metadata: { reason: "validation_failed" },
          });
          return null;
        }

        const admin = await prisma.admin.findUnique({
          where: { username: parsed.data.username },
        });

        if (!admin || !admin.isActive) {
          await writeAuthAuditLog({
            action: "ADMIN_LOGIN_FAILED",
            result: "FAILURE",
            request,
            metadata: { reason: "invalid_credentials" },
          });
          return null;
        }

        const passwordValid = await verifyPassword(admin.passwordHash, parsed.data.password);
        if (!passwordValid) {
          await writeAuthAuditLog({
            actorId: admin.id,
            action: "ADMIN_LOGIN_FAILED",
            result: "FAILURE",
            request,
            metadata: { reason: "invalid_credentials" },
          });
          return null;
        }

        await prisma.$transaction([
          prisma.admin.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date() },
          }),
          prisma.auditLog.create({
            data: {
              actorId: admin.id,
              action: "ADMIN_LOGIN_SUCCESS",
              result: "SUCCESS",
              targetType: "admin",
              targetId: admin.id,
              ipAddress: getClientIp(request),
              userAgent: request.headers.get("user-agent"),
              metadata: {},
            },
          }),
        ]);

        logger.info("Admin login succeeded", {
          adminId: admin.id,
          username: admin.username,
          role: admin.role,
        });

        return {
          id: admin.id,
          name: admin.username,
          email: admin.email,
          username: admin.username,
          role: admin.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        if (user.id) {
          token.id = user.id;
        }
        token.username = user.username;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id && token.username && token.role) {
        session.user.id = String(token.id);
        session.user.username = String(token.username);
        session.user.role = token.role;
      }

      return session;
    },
  },
};
