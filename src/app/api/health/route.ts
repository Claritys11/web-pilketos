import { config } from "@/config/env";
import { fail, ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { storageService } from "@/lib/storage";

export async function GET() {
  const checks = {
    database: "ok",
    storage: "ok",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = "error";
  }

  const storageStatus = await storageService.ping();
  checks.storage = storageStatus === "ok" ? "ok" : "error";

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
