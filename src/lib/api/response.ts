import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ServiceError } from "@/services/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(code: string, message: string, status: number, details: unknown = null) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ServiceError) {
    return fail(error.code, error.message, error.status, error.details ?? null);
  }

  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Input tidak valid.", 400, error.flatten().fieldErrors);
  }

  return fail("INTERNAL_ERROR", "Terjadi kesalahan internal.", 500);
}

export function csv(body: string, filename: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
