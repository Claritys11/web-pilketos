import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { csv, handleApiError } from "@/lib/api/response";
import { electionIdQuerySchema } from "@/schemas/api";
import { auditService } from "@/services/audit.service";
import { tokenService } from "@/services/token.service";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { electionId } = electionIdQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const tokens = await tokenService.exportTokenMetadata(electionId);
    await auditService.writeLog({
      actorId: admin.id,
      action: "TOKEN_BATCH_EXPORTED",
      targetType: "election",
      targetId: electionId,
      result: "SUCCESS",
      ...getRequestContext(request),
      metadata: {
        electionId,
        tokenCount: tokens.length,
      },
    });

    const rows = tokens.map((token, index) =>
      [
        index + 1,
        token.studentIdentifier ?? "",
        token.studentName ?? "",
        token.studentClass ?? "",
        token.studentEmail ?? "",
        token.voterType ?? "",
        token.usedAt ? "USED" : "UNUSED",
        token.emailSentAt ? "SENT" : token.emailError ? "FAILED" : "NOT_SENT",
        token.emailSentAt?.toISOString() ?? "",
        token.emailError ?? "",
        token.createdAt.toISOString(),
        token.usedAt?.toISOString() ?? "",
      ]
        .map(escapeCsvCell)
        .join(","),
    );

    return csv(
      [
        "token_number,student_identifier,student_name,student_class,student_email,voter_type,status,email_status,email_sent_at,email_error,created_at,used_at",
        ...rows,
      ].join("\n"),
      "tokens-pilketos.csv",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
