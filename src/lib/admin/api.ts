"use client";

import type { ApiResponse } from "@/lib/admin/types";

export class AdminApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function formatErrorDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const messages = Object.entries(details)
    .flatMap(([field, value]) => {
      if (Array.isArray(value)) {
        return value.map((message) => `${field}: ${String(message)}`);
      }

      return [`${field}: ${String(value)}`];
    })
    .filter(Boolean);

  return messages.length ? messages.join("; ") : null;
}

export async function adminFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw new AdminApiError("HTTP_ERROR", response.statusText, response.status);
    }
    return undefined as T;
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    const details = formatErrorDetails(payload.error.details);
    throw new AdminApiError(
      payload.error.code,
      details ? `${payload.error.message} ${details}` : payload.error.message,
      response.status,
      payload.error.details,
    );
  }

  return payload.data;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
