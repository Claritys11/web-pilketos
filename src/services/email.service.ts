import nodemailer from "nodemailer";

import { config } from "@/config/env";

export interface TokenEmailInput {
  to: string;
  studentName: string;
  studentIdentifier?: string | null;
  electionTitle: string;
  token: string;
  voteUrl: string;
}

export interface TokenEmailResult {
  ok: boolean;
  skipped: boolean;
  error?: string;
}

interface GmailProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  from: string;
}

class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

export class EmailService {
  async sendVotingToken(input: TokenEmailInput): Promise<TokenEmailResult> {
    if (!config.mail.enabled) {
      return {
        ok: false,
        skipped: true,
        error:
          config.mail.driver === "gmail_api"
            ? "Gmail API belum dikonfigurasi."
            : config.mail.driver === "smtp"
              ? "SMTP belum dikonfigurasi."
              : "Pengiriman email dinonaktifkan.",
      };
    }

    if (config.mail.driver === "gmail_api") {
      return this.sendWithGmailApi(input);
    }

    if (config.mail.driver === "smtp") {
      return this.sendWithSmtp(input);
    }

    return {
      ok: false,
      skipped: true,
      error: "Pengiriman email dinonaktifkan.",
    };
  }

  private async sendWithSmtp(input: TokenEmailInput): Promise<TokenEmailResult> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.mail.smtpHost,
        port: config.mail.smtpPort,
        secure: config.mail.smtpSecure,
        auth:
          config.mail.smtpUser && config.mail.smtpPassword
            ? {
                user: config.mail.smtpUser,
                pass: config.mail.smtpPassword,
              }
            : undefined,
      });

      await transporter.sendMail({
        from: config.mail.from,
        to: input.to,
        subject: `Token Voting ${input.electionTitle}`,
        text: [
          `Halo ${input.studentName},`,
          "",
          `Berikut token voting Pilketos untuk ${input.electionTitle}.`,
          "",
          ...(input.studentIdentifier ? [`NIS/ID: ${input.studentIdentifier}`] : []),
          `Token: ${input.token}`,
          `Link voting otomatis: ${input.voteUrl}`,
          "",
          "Token ini hanya bisa dipakai satu kali. Jangan bagikan token ini kepada orang lain.",
        ].join("\n"),
        html: [
          `<p>Halo ${escapeHtml(input.studentName)},</p>`,
          `<p>Berikut token voting Pilketos untuk <strong>${escapeHtml(
            input.electionTitle,
          )}</strong>.</p>`,
          ...(input.studentIdentifier
            ? [`<p><strong>NIS/ID:</strong> ${escapeHtml(input.studentIdentifier)}</p>`]
            : []),
          `<p><strong>Token:</strong> <code style="font-size:18px">${escapeHtml(
            input.token,
          )}</code></p>`,
          renderVoteButton(input.voteUrl),
          `<p>Token ini hanya bisa dipakai satu kali. Jangan bagikan token ini kepada orang lain.</p>`,
        ].join(""),
      });

      return {
        ok: true,
        skipped: false,
      };
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        error: error instanceof Error ? error.message : "Gagal mengirim email.",
      };
    }
  }

  private async sendWithGmailApi(input: TokenEmailInput): Promise<TokenEmailResult> {
    try {
      const providers = config.mail.gmailProviders;
      if (providers.length === 0) {
        return {
          ok: false,
          skipped: true,
          error: "Gmail API belum lengkap. Isi client id, client secret, refresh token, dan from.",
        };
      }

      const errors: string[] = [];
      for (const provider of providers) {
        const result = await this.trySendWithGmailProvider(provider, input);
        if (result.ok) {
          return result;
        }

        errors.push(`${provider.name}: ${result.error ?? "Gagal mengirim email."}`);
      }

      return {
        ok: false,
        skipped: false,
        error: errors.join(" | "),
      };
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        error: formatEmailError(error, "Gagal mengirim email via Gmail API."),
      };
    }
  }

  private async trySendWithGmailProvider(
    provider: GmailProvider,
    input: TokenEmailInput,
  ): Promise<TokenEmailResult> {
    try {
      const accessToken = await getGmailAccessToken({
        clientId: provider.clientId,
        clientSecret: provider.clientSecret,
        refreshToken: provider.refreshToken,
      });
      const raw = buildRawMessage({
        from: provider.from,
        to: input.to,
        subject: `Token Voting ${input.electionTitle}`,
        text: [
          `Halo ${input.studentName},`,
          "",
          `Berikut token voting Pilketos untuk ${input.electionTitle}.`,
          "",
          ...(input.studentIdentifier ? [`NIS/ID: ${input.studentIdentifier}`] : []),
          `Token: ${input.token}`,
          `Link voting otomatis: ${input.voteUrl}`,
          "",
          "Token ini hanya bisa dipakai satu kali. Jangan bagikan token ini kepada orang lain.",
        ].join("\n"),
        html: [
          `<p>Halo ${escapeHtml(input.studentName)},</p>`,
          `<p>Berikut token voting Pilketos untuk <strong>${escapeHtml(
            input.electionTitle,
          )}</strong>.</p>`,
          ...(input.studentIdentifier
            ? [`<p><strong>NIS/ID:</strong> ${escapeHtml(input.studentIdentifier)}</p>`]
            : []),
          `<p><strong>Token:</strong> <code style="font-size:18px">${escapeHtml(
            input.token,
          )}</code></p>`,
          renderVoteButton(input.voteUrl),
          `<p>Token ini hanya bisa dipakai satu kali. Jangan bagikan token ini kepada orang lain.</p>`,
        ].join(""),
      });

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      if (!response.ok) {
        throw new GmailApiError(
          `Gmail API ${response.status}: ${await readGmailError(response)}`,
          response.status,
        );
      }

      return {
        ok: true,
        skipped: false,
      };
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        error: formatEmailError(error, "Gagal mengirim email via Gmail API."),
      };
    }
  }
}

async function getGmailAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new GmailApiError(
      data.error_description ?? data.error ?? "Gagal mengambil Gmail access token.",
      response.status,
    );
  }

  return data.access_token;
}

async function readGmailError(response: Response) {
  const text = await response.text();
  if (!text) {
    return "Tidak ada detail error dari Gmail.";
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    };
    const reason = parsed.error?.errors?.find((item) => item.reason)?.reason;
    return [parsed.error?.message, parsed.error?.status, reason].filter(Boolean).join(" / ");
  } catch {
    return text;
  }
}

function buildRawMessage({
  from,
  to,
  subject,
  text,
  html,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const boundary = `pilketos_${Date.now().toString(36)}`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderVoteButton(voteUrl: string) {
  const escapedUrl = escapeHtml(voteUrl);
  return [
    `<p style="margin:24px 0">`,
    `<a href="${escapedUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;padding:14px 22px">`,
    "Buka Voting dan Isi Token Otomatis",
    "</a>",
    "</p>",
    `<p style="font-size:13px;color:#525252">Jika tombol tidak bisa dibuka, salin link ini:<br><a href="${escapedUrl}">${escapedUrl}</a></p>`,
  ].join("");
}

function formatEmailError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const cause = error.cause;
  if (cause instanceof Error && cause.message && cause.message !== error.message) {
    return `${error.message}: ${cause.message}`;
  }

  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string") {
    return `${error.message}: ${cause.code}`;
  }

  return error.message;
}

export const emailService = new EmailService();
