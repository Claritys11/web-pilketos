import crypto from "node:crypto";

import type { VoterType } from "@prisma/client";

import { config } from "@/config/env";

const GOOGLE_API_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_HEADERS = [
  "token_id",
  "election_id",
  "election_title",
  "voter_type",
  "student_identifier",
  "student_name",
  "student_class",
  "student_email",
  "token_status",
  "email_status",
  "email_sent_at",
  "email_error",
  "used_at",
  "updated_at",
] as const;

export interface SheetTokenRow {
  tokenId: string;
  electionId: string;
  electionTitle: string;
  voterType: VoterType | null;
  studentIdentifier: string | null;
  studentName: string | null;
  studentClass: string | null;
  studentEmail: string | null;
  emailSentAt: Date | string | null;
  emailError: string | null;
  usedAt: Date | string | null;
}

class GoogleSheetsService {
  private accessToken: { value: string; expiresAt: number } | null = null;

  get enabled() {
    return config.sheets.enabled;
  }

  async syncTokenRows(rows: SheetTokenRow[]) {
    if (!this.enabled || rows.length === 0) {
      return;
    }

    try {
      const firstRow = rows[0];
      if (!firstRow) {
        return;
      }

      const spreadsheetId = this.spreadsheetId();
      const sheetTitle = sheetTitleForElection(firstRow);
      await this.ensureHeader(spreadsheetId, sheetTitle);
      await this.appendRows(spreadsheetId, sheetTitle, rows.map(formatTokenRow));
    } catch (error) {
      logSheetsWarning("Gagal sync token ke Google Sheets", error);
    }
  }

  async syncTokenRow(row: SheetTokenRow) {
    if (!this.enabled) {
      return;
    }

    try {
      const spreadsheetId = this.spreadsheetId();
      const sheetTitle = sheetTitleForElection(row);
      await this.ensureHeader(spreadsheetId, sheetTitle);
      const rowNumber = await this.findRowNumber(spreadsheetId, sheetTitle, row.tokenId);
      if (rowNumber) {
        await this.updateRow(spreadsheetId, sheetTitle, rowNumber, formatTokenRow(row));
      } else {
        await this.appendRows(spreadsheetId, sheetTitle, [formatTokenRow(row)]);
      }
    } catch (error) {
      logSheetsWarning("Gagal update token di Google Sheets", error);
    }
  }

  private spreadsheetId() {
    if (!config.sheets.spreadsheetId) {
      throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID wajib diisi untuk Google Sheets sync.");
    }

    return config.sheets.spreadsheetId;
  }

  private async ensureHeader(spreadsheetId: string, sheetTitle: string) {
    await this.ensureSheetExists(spreadsheetId, sheetTitle);
    const values = await this.requestValues(spreadsheetId, sheetTitle, "A1:N1");
    const currentHeader = values[0]?.join(",") ?? "";
    if (currentHeader === SHEET_HEADERS.join(",")) {
      return;
    }

    await this.updateRange(spreadsheetId, sheetTitle, "A1:N1", [SHEET_HEADERS]);
  }

  private async ensureSheetExists(spreadsheetId: string, sheetTitle: string) {
    const response = await this.fetchGoogle(
      `${this.baseUrl(spreadsheetId)}?fields=sheets.properties.title`,
    );
    if (!response.ok) {
      throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      sheets?: Array<{ properties?: { title?: string } }>;
    };
    const exists = data.sheets?.some((sheet) => sheet.properties?.title === sheetTitle);
    if (exists) {
      return;
    }

    const createResponse = await this.fetchGoogle(`${this.baseUrl(spreadsheetId)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Sheets API ${createResponse.status}: ${await createResponse.text()}`);
    }
  }

  private async findRowNumber(spreadsheetId: string, sheetTitle: string, tokenId: string) {
    const values = await this.requestValues(spreadsheetId, sheetTitle, "A:A");
    const index = values.findIndex((row) => row[0] === tokenId);
    return index >= 0 ? index + 1 : null;
  }

  private async requestValues(spreadsheetId: string, sheetTitle: string, range: string) {
    const response = await this.fetchGoogle(
      `${this.baseUrl(spreadsheetId)}/values/${encodeURIComponent(sheetRange(sheetTitle, range))}`,
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { values?: string[][] };
    return data.values ?? [];
  }

  private async appendRows(spreadsheetId: string, sheetTitle: string, rows: string[][]) {
    const response = await this.fetchGoogle(
      `${this.baseUrl(spreadsheetId)}/values/${encodeURIComponent(sheetRange(sheetTitle, "A:N"))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({ values: rows }),
      },
    );

    if (!response.ok) {
      throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
    }
  }

  private async updateRow(
    spreadsheetId: string,
    sheetTitle: string,
    rowNumber: number,
    row: string[],
  ) {
    await this.updateRange(spreadsheetId, sheetTitle, `A${rowNumber}:N${rowNumber}`, [row]);
  }

  private async updateRange(
    spreadsheetId: string,
    sheetTitle: string,
    range: string,
    rows: readonly (readonly string[])[],
  ) {
    const response = await this.fetchGoogle(
      `${this.baseUrl(spreadsheetId)}/values/${encodeURIComponent(sheetRange(sheetTitle, range))}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values: rows }),
      },
    );

    if (!response.ok) {
      throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
    }
  }

  private baseUrl(spreadsheetId: string) {
    return `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}`;
  }

  private async fetchGoogle(url: string, init: RequestInit = {}) {
    const token = await this.getAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }

  private async getAccessToken() {
    const cached = this.accessToken;
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.value;
    }

    if (!config.sheets.clientEmail || !config.sheets.privateKey) {
      throw new Error("Google Sheets service account belum dikonfigurasi.");
    }

    const now = Math.floor(Date.now() / 1000);
    const assertion = signJwt({
      iss: config.sheets.clientEmail,
      scope: GOOGLE_API_SCOPE,
      aud: SHEETS_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    });

    const response = await fetch(SHEETS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description ?? data.error ?? "Gagal mengambil access token.");
    }

    this.accessToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };

    return data.access_token;
  }
}

function formatTokenRow(row: SheetTokenRow) {
  return [
    row.tokenId,
    row.electionId,
    row.electionTitle,
    row.voterType === "TEACHER" ? "GURU" : "SISWA",
    row.studentIdentifier ?? "",
    row.studentName ?? "",
    row.studentClass ?? "",
    row.studentEmail ?? "",
    row.usedAt ? "SUDAH_VOTING" : "BELUM_VOTING",
    row.emailSentAt ? "TERKIRIM" : row.emailError ? "GAGAL" : "BELUM_DIKIRIM",
    toIso(row.emailSentAt),
    row.emailError ?? "",
    toIso(row.usedAt),
    new Date().toISOString(),
  ];
}

function toIso(value: Date | string | null) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : value;
}

function sheetTitleForElection(row: Pick<SheetTokenRow, "electionId" | "electionTitle">) {
  const prefix = config.sheets.sheetName ?? "Pilketos";
  const suffix = row.electionId.slice(-6);
  const rawTitle = `${prefix} - ${row.electionTitle} - ${suffix}`;
  return sanitizeSheetTitle(rawTitle);
}

function sanitizeSheetTitle(value: string) {
  return value
    .replace(/[\][*?/\\:]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function sheetRange(sheetTitle: string, range: string) {
  return `'${sheetTitle.replaceAll("'", "''")}'!${range}`;
}

function signJwt(payload: Record<string, string | number>) {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(data), config.sheets.privateKey ?? "");
  return `${data}.${base64Url(signature)}`;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function logSheetsWarning(message: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[Pilketos] ${message}: ${detail}`);
}

export const googleSheetsService = new GoogleSheetsService();
