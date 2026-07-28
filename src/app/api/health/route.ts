import { config } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { storageService } from "@/lib/storage";
import { fail, ok } from "@/lib/api/response";

export async function GET() {
  const checks = {
    database: "ok",
    storage: "ok",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = error instanceof Error ? `error: ${error.message}` : "error";
  }

  const storageStatus = await storageService.ping();
  checks.storage = storageStatus;

  const data = {
    status: checks.database === "ok" && checks.storage === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: config.app.version,
    uptime: Math.round(process.uptime()),
    checks,
  };

  if (data.status === "ok") {
    return ok(data);
  }

  return fail("SERVICE_UNAVAILABLE", "Salah satu layanan tidak tersedia.", 503, data);
}
