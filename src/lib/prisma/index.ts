/**
 * Prisma Client Singleton — Pilketos E-Voting System
 *
 * Provides a global PrismaClient instance configured with the @prisma/adapter-pg
 * driver adapter for Prisma 7 compatibility and connection pooling.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §Layer 4 — Data Access
 */

import { config } from "@/config/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: config.database.url,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (config.app.isDevelopment) {
    globalForPrisma.pgPool = pool;
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (config.app.isDevelopment) {
  globalForPrisma.prisma = prisma;
}
