"use client";

import Link from "next/link";
import { LoaderCircle, Pencil, RefreshCw, Send } from "lucide-react";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Alert } from "@/components/common/Alert";
import { Badge, electionStatusTone } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { SkeletonCard } from "@/components/common/Skeleton";
import { MAX_TOKEN_BATCH_SIZE } from "@/config/tokens";
import { adminFetch } from "@/lib/admin/api";
import type { AdminSessionUser, DashboardStats, ElectionDetail } from "@/lib/admin/types";
import type { VoterType } from "@/lib/admin/types";

type GeneratorMode = "count" | "students";
type TokenStatusFilter = "all" | "used" | "unused";

interface TokenAssignment {
  studentIdentifier?: string | null;
  studentName: string;
  studentClass?: string | null;
  studentEmail?: string | null;
  voterType?: VoterType;
  emailStatus?: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  emailError?: string | null;
}

interface GenerateResult {
  electionId: string;
  generatedCount: number;
  tokens: string[];
  assignedTokens?: TokenAssignment[];
  emailSummary?: {
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
  };
  sheetsSync?: {
    status: "SYNCED" | "DISABLED" | "FAILED";
    spreadsheetUrl: string | null;
    error: string | null;
  };
}

interface TokenMetadata {
  id: string;
  studentIdentifier: string | null;
  studentName: string | null;
  studentClass: string | null;
  studentEmail: string | null;
  voterType: VoterType | null;
  emailSentAt: string | null;
  emailError: string | null;
  reminderSentAt: string | null;
  reminderError: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface EmailDeliveryResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
}

interface UpdateTokenEmailResult {
  token: TokenMetadata;
  sheetsSync: {
    status: "SYNCED" | "DISABLED" | "FAILED";
    error: string | null;
  } | null;
}

interface ParsedStudent {
  studentIdentifier?: string;
  studentName: string;
  studentClass?: string;
  studentEmail?: string;
  voterType: VoterType;
}

export function TokensClient({ electionId, user }: { electionId: string; user: AdminSessionUser }) {
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tokens, setTokens] = useState<TokenMetadata[]>([]);
  const [count, setCount] = useState(50);
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>("students");
  const [studentInput, setStudentInput] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenStatusFilter, setTokenStatusFilter] = useState<TokenStatusFilter>("all");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [deliveringEmail, setDeliveringEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendTarget, setResendTarget] = useState<TokenMetadata | null>(null);
  const [emailEditTarget, setEmailEditTarget] = useState<TokenMetadata | null>(null);
  const [editedEmail, setEditedEmail] = useState("");
  const [emailEditError, setEmailEditError] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState<"save" | "send" | null>(null);
  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canGenerate = user.role !== "VIEWER" && election?.status === "SETUP";
  const canManageEmail =
    user.role !== "VIEWER" &&
    Boolean(election && election.status !== "CLOSED" && election.status !== "ARCHIVED");
  const pendingEmails = tokens.filter(
    (token) => token.studentEmail && !token.emailSentAt && !token.emailError,
  ).length;
  const failedEmails = tokens.filter(
    (token) => token.studentEmail && !token.emailSentAt && token.emailError,
  ).length;

  const weightedMode = election?.mode === "WEIGHTED_FIVE";
  const activeGeneratorMode: GeneratorMode = weightedMode ? "students" : generatorMode;
  const parsedStudents = useMemo(
    () => parseStudents(studentInput, weightedMode),
    [studentInput, weightedMode],
  );
  const filteredTokens = useMemo(() => {
    const query = tokenSearch.trim().toLowerCase();

    return tokens.filter((token) => {
      if (tokenStatusFilter === "used" && !token.usedAt) {
        return false;
      }

      if (tokenStatusFilter === "unused" && token.usedAt) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [token.studentIdentifier, token.studentName, token.studentClass, token.studentEmail]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [tokenSearch, tokenStatusFilter, tokens]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [electionData, statsData, tokenData] = await Promise.all([
        adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}`),
        adminFetch<DashboardStats>(`/api/admin/dashboard/stats?electionId=${electionId}`),
        adminFetch<TokenMetadata[]>(`/api/admin/tokens?electionId=${electionId}`),
      ]);
      setElection(electionData);
      setStats(statsData);
      setTokens(tokenData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat token.");
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void load();
      }
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function generateTokens(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    try {
      setError(null);
      const body =
        activeGeneratorMode === "students"
          ? { electionId, students: parsedStudents }
          : { electionId, count };

      const result = await adminFetch<GenerateResult>("/api/admin/tokens/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setGenerated(result);
      setGeneratorOpen(false);
      await load();
      if ((result.emailSummary?.pending ?? 0) > 0) {
        void deliverPendingEmails();
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal generate token.");
    } finally {
      setGenerating(false);
    }
  }

  async function deliverPendingEmails() {
    if (deliveringEmail) {
      return;
    }
    setDeliveringEmail(true);
    setError(null);
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    try {
      while (true) {
        const result = await requestEmailDelivery("PENDING");
        totalSent += result.sent;
        totalFailed += result.failed;
        totalSkipped += result.skipped;
        setGenerated((current) =>
          current?.emailSummary
            ? {
                ...current,
                emailSummary: {
                  sent: current.emailSummary.sent + result.sent,
                  failed: current.emailSummary.failed + result.failed,
                  skipped: current.emailSummary.skipped + result.skipped,
                  pending: result.remaining,
                },
              }
            : current,
        );
        setImportMessage(
          `Pengiriman berjalan: ${totalSent} terkirim, ${totalFailed} gagal, ${totalSkipped} dilewati, ${result.remaining} masih antre.`,
        );
        if (result.remaining === 0 || result.attempted === 0) {
          break;
        }
      }
      await load();
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? `Pengiriman berhenti sementara: ${fetchError.message} Token tetap tersimpan dan bisa dilanjutkan.`
          : "Pengiriman berhenti sementara. Token tetap tersimpan dan bisa dilanjutkan.",
      );
      await load();
    } finally {
      setDeliveringEmail(false);
    }
  }

  function requestEmailDelivery(mode: "PENDING" | "FAILED" | "RESEND", tokenId?: string) {
    return adminFetch<EmailDeliveryResult>("/api/admin/tokens/retry-email", {
      method: "POST",
      body: JSON.stringify({ electionId, mode, ...(tokenId ? { tokenId } : {}) }),
    });
  }

  async function retryFailedEmails() {
    setRetryingEmail(true);
    try {
      setError(null);
      const result = await requestEmailDelivery("FAILED");
      setImportMessage(
        `Retry batch selesai: ${result.sent} terkirim, ${result.failed} masih gagal, ${result.skipped} dilewati. Sisa gagal: ${result.remaining}.`,
      );
      await load();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal retry email token.");
    } finally {
      setRetryingEmail(false);
    }
  }

  async function resendSentEmail() {
    if (!resendTarget) {
      return;
    }

    setResendingEmail(true);
    try {
      setError(null);
      const result = await requestEmailDelivery("RESEND", resendTarget.id);
      if (result.sent === 1) {
        setImportMessage(`Token berhasil dikirim ulang ke ${resendTarget.studentEmail}.`);
      } else {
        setError(
          `Email token ke ${resendTarget.studentEmail} belum berhasil dikirim ulang. Periksa status error pada tabel.`,
        );
      }
      setResendTarget(null);
      await load();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal mengirim ulang token.");
    } finally {
      setResendingEmail(false);
    }
  }

  function startEmailEdit(token: TokenMetadata) {
    setEmailEditTarget(token);
    setEditedEmail(token.studentEmail ?? "");
    setEmailEditError(null);
  }

  async function saveTokenEmail(sendAfterSave: boolean) {
    if (!emailEditTarget) {
      return;
    }

    const studentEmail = editedEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      setEmailEditError("Masukkan alamat email yang valid.");
      return;
    }
    if (studentEmail === emailEditTarget.studentEmail?.trim().toLowerCase()) {
      setEmailEditError("Email baru sama dengan email yang tersimpan.");
      return;
    }

    setSavingEmail(sendAfterSave ? "send" : "save");
    setEmailEditError(null);
    setError(null);
    setImportMessage(null);

    try {
      const result = await adminFetch<UpdateTokenEmailResult>(
        `/api/admin/tokens/${emailEditTarget.id}/email`,
        {
          method: "PATCH",
          body: JSON.stringify({ studentEmail }),
        },
      );

      let outcomeMessage: string | null = null;
      let outcomeError: string | null = null;
      if (sendAfterSave) {
        try {
          const delivery = await requestEmailDelivery("RESEND", emailEditTarget.id);
          if (delivery.sent === 1) {
            outcomeMessage = `Email diperbarui dan token berhasil dikirim ke ${studentEmail}.`;
          } else {
            outcomeError = `Email sudah diperbarui ke ${studentEmail}, tetapi token belum berhasil dikirim. Periksa status email lalu gunakan Resend.`;
          }
        } catch (deliveryError) {
          outcomeError = `Email sudah diperbarui ke ${studentEmail}, tetapi pengiriman gagal: ${
            deliveryError instanceof Error ? deliveryError.message : "kesalahan tidak diketahui"
          }`;
        }
      } else {
        outcomeMessage = `Email pemilih berhasil diperbarui ke ${studentEmail}.`;
      }

      if (result.sheetsSync?.status === "FAILED") {
        outcomeError = `Email tersimpan, tetapi Google Sheets belum tersinkron: ${result.sheetsSync.error ?? "coba sinkronkan ulang dari detail election."}`;
      }
      await load();
      setEmailEditTarget(null);
      setImportMessage(outcomeMessage);
      setError(outcomeError);
    } catch (saveError) {
      setEmailEditError(saveError instanceof Error ? saveError.message : "Email gagal diperbarui.");
    } finally {
      setSavingEmail(null);
    }
  }

  async function handleStudentFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setImportMessage(null);
      const parsedRows =
        file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".tsv")
          ? parseStudents(await file.text(), weightedMode, true)
          : await parseExcelFile(file, weightedMode);

      if (parsedRows.length === 0) {
        throw new Error("File tidak berisi data pemilih yang valid.");
      }

      setStudentInput(parsedRows.map(formatStudentLine).join("\n"));
      setImportMessage(`${parsedRows.length} pemilih dimuat dari ${file.name}.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Gagal membaca file import.");
    } finally {
      event.target.value = "";
    }
  }

  if (loading) {
    return <SkeletonCard />;
  }

  const totalTokens = stats?.totalTokens ?? election?._count?.tokens ?? 0;
  const usedTokens = stats?.usedTokens ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/elections/${electionId}`}
        className="text-sm font-semibold text-[var(--color-primary-700)] hover:underline"
      >
        Kembali ke detail election
      </Link>

      <AdminPageHeader
        eyebrow={election?.title ?? "Election"}
        title="Token Voting"
        description="Distribusikan satu token per pemilih, pantau status email, dan cek siapa yang sudah atau belum menggunakan token."
      >
        {election ? (
          <Badge tone={electionStatusTone(election.status)}>{election.status}</Badge>
        ) : null}
        <button
          type="button"
          onClick={() => void deliverPendingEmails()}
          disabled={!canManageEmail || deliveringEmail || pendingEmails === 0}
          className="h-11 rounded-lg border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
        >
          {deliveringEmail
            ? `Mengirim... (${pendingEmails} antre)`
            : `Kirim Email Antre (${pendingEmails})`}
        </button>
        <button
          type="button"
          onClick={() => void retryFailedEmails()}
          disabled={!canManageEmail || retryingEmail || deliveringEmail || failedEmails === 0}
          className="h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {retryingEmail ? "Retry..." : `Retry Email Gagal (${failedEmails})`}
        </button>
        <button
          type="button"
          onClick={() => setGeneratorOpen(true)}
          disabled={!canGenerate}
          className="h-11 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
        >
          Generate Token
        </button>
        <a
          href={`/api/admin/tokens/export?electionId=${electionId}`}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Export Metadata
        </a>
      </AdminPageHeader>

      {!canGenerate ? (
        <Alert tone="warning" title="Generate terkunci">
          Token hanya bisa dibuat saat election masih SETUP dan akun bukan VIEWER.
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" title="Token gagal diproses">
          {error}
        </Alert>
      ) : null}
      {importMessage ? (
        <Alert tone="success" title="Import/email selesai">
          {importMessage}
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Total token" value={String(totalTokens)} />
        <Stat label="Dipakai" value={String(usedTokens)} />
        <Stat label="Belum dipakai" value={String(Math.max(totalTokens - usedTokens, 0))} />
        <Stat
          label="Pemilih terdata"
          value={String(tokens.filter((token) => token.studentName || token.studentEmail).length)}
        />
      </section>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Distribusi Token Per Pemilih</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              {weightedMode
                ? "Upload pemilih OSIS, MPK, dan GURU tanpa NIS/ID. Kelas hanya dicatat untuk OSIS/MPK."
                : "Upload Excel/CSV berisi pemilih siswa dan guru, lalu sistem membuat satu token per identitas."}{" "}
              Plaintext token tidak ditampilkan atau didownload dari admin; pengiriman dilakukan
              lewat email.
            </p>
          </div>
          <a
            href={`/api/admin/tokens/import-template?mode=${weightedMode ? "WEIGHTED_FIVE" : "STANDARD"}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Download Template CSV
          </a>
        </div>
      </section>

      <section className="rounded-lg border border-red-100 bg-white shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-3 border-b border-red-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Status Token Pemilih</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Menampilkan {filteredTokens.length} dari {tokens.length} token.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={tokenSearch}
              onChange={(event) => setTokenSearch(event.target.value)}
              placeholder={
                weightedMode ? "Cari nama, kelas, email" : "Cari NIS, nama, kelas, email"
              }
              className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] sm:w-64"
            />
            <div className="flex h-10 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {(["all", "unused", "used"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTokenStatusFilter(status)}
                  className={`px-3 text-sm font-semibold ${
                    tokenStatusFilter === status
                      ? "bg-[var(--color-vote-primary)] text-white"
                      : "text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-red-50/70 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-3">No</th>
                {!weightedMode ? <th className="px-5 py-3">NIS/ID</th> : null}
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Kelas</th>
                <th className="px-5 py-3">Tipe</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Email token</th>
                <th className="px-5 py-3">Reminder</th>
                <th className="px-5 py-3">Dipakai pada</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredTokens.length > 0 ? (
                filteredTokens.map((token, index) => (
                  <tr key={token.id} className="hover:bg-red-50/40">
                    <td className="px-5 py-3 text-neutral-500">{index + 1}</td>
                    {!weightedMode ? (
                      <td className="px-5 py-3 font-semibold text-neutral-950">
                        {token.studentIdentifier ?? "-"}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-neutral-700">{token.studentName ?? "-"}</td>
                    <td className="px-5 py-3 text-neutral-700">{token.studentClass ?? "-"}</td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={
                          token.voterType === "TEACHER" || token.voterType === "GURU"
                            ? "warning"
                            : token.voterType === "OSIS" || token.voterType === "MPK"
                              ? "primary"
                              : "neutral"
                        }
                      >
                        {voterTypeLabel(token.voterType)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{token.studentEmail ?? "-"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={token.usedAt ? "success" : "neutral"}>
                        {token.usedAt ? "Sudah dipakai" : "Belum dipakai"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={emailTone(token)}>
                        {token.emailSentAt ? "Terkirim" : token.emailError ? "Gagal" : "Belum"}
                      </Badge>
                      {token.emailError ? (
                        <p className="mt-1 max-w-64 truncate text-xs text-red-600">
                          {token.emailError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={reminderTone(token)}>
                        {reminderLabel(token, election?.status ?? "SETUP")}
                      </Badge>
                      {token.reminderError && !token.usedAt ? (
                        <p className="mt-1 max-w-64 truncate text-xs text-red-600">
                          {token.reminderError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-neutral-500">{formatDateTime(token.usedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!token.usedAt ? (
                          <button
                            type="button"
                            onClick={() => startEmailEdit(token)}
                            disabled={!canManageEmail || savingEmail !== null}
                            title="Ubah email pemilih"
                            aria-label={`Ubah email ${token.studentName ?? "pemilih"}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                          >
                            <Pencil aria-hidden="true" className="size-4" />
                          </button>
                        ) : null}
                        {token.emailSentAt && token.studentEmail && !token.usedAt ? (
                          <button
                            type="button"
                            onClick={() => setResendTarget(token)}
                            disabled={!canManageEmail || resendingEmail}
                            title="Kirim ulang token yang sama"
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-200 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                          >
                            <RefreshCw aria-hidden="true" className="size-4" />
                            Resend
                          </button>
                        ) : null}
                        {token.usedAt ? <span className="text-neutral-400">-</span> : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={weightedMode ? 10 : 11}
                    className="px-5 py-8 text-center text-neutral-500"
                  >
                    Belum ada token yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {generatorOpen ? (
        <Modal title="Generate Token" onClose={() => setGeneratorOpen(false)}>
          <form onSubmit={generateTokens} className="space-y-5">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-red-50 p-1">
              <button
                type="button"
                onClick={() => setGeneratorMode("students")}
                className={`h-10 rounded-md text-sm font-semibold ${
                  activeGeneratorMode === "students"
                    ? "bg-white text-[var(--color-primary-700)] shadow-sm"
                    : "text-neutral-600"
                }`}
              >
                Per Siswa
              </button>
              <button
                type="button"
                onClick={() => setGeneratorMode("count")}
                disabled={weightedMode}
                className={`h-10 rounded-md text-sm font-semibold ${
                  activeGeneratorMode === "count"
                    ? "bg-white text-[var(--color-primary-700)] shadow-sm"
                    : "text-neutral-600 disabled:opacity-40"
                }`}
              >
                Jumlah Biasa
              </button>
            </div>

            {activeGeneratorMode === "students" ? (
              <>
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-800">Import pemilih</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv"
                    onChange={(event) => void handleStudentFileUpload(event)}
                    className="mt-2 block w-full rounded-lg border border-dashed border-red-200 bg-red-50/40 px-3 py-3 text-sm"
                  />
                  <span className="mt-2 block text-xs font-medium text-neutral-500">
                    {weightedMode
                      ? "Kolom: nama, kelas, email, role. Header boleh ada atau tidak. Role wajib OSIS/MPK/GURU; kelas tidak perlu untuk GURU; NIS/ID tidak digunakan."
                      : "Header: student_identifier/nis/id, student_name/nama, student_class/kelas, student_email/email, voter_type/role. Role SISWA/GURU."}{" "}
                    CSV dengan koma di dalam nama atau jabatan didukung. Email dikirim bertahap
                    mengikuti batas server.
                  </span>
                  <a
                    href={`/api/admin/tokens/import-template?mode=${weightedMode ? "WEIGHTED_FIVE" : "STANDARD"}`}
                    className="mt-2 inline-block text-xs font-semibold text-[var(--color-primary-700)] hover:underline"
                  >
                    Download template sesuai mode
                  </a>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-neutral-800">
                    Daftar pemilih terdeteksi
                  </span>
                  <textarea
                    value={studentInput}
                    onChange={(event) => setStudentInput(event.target.value)}
                    rows={10}
                    placeholder={
                      weightedMode
                        ? "Nama OSIS,XII RPL 1,osis@example.com,OSIS\nNama Guru,,guru@example.com,GURU"
                        : "12345,Nama Siswa,XII RPL 1,siswa@example.com,SISWA"
                    }
                    className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
                  />
                  <span className="mt-2 block text-xs font-medium text-neutral-500">
                    {weightedMode
                      ? "Format: Nama, Kelas, Email, Role. Untuk GURU, kelas boleh kosong."
                      : "Format: ID, Nama, Kelas/Jabatan, Email, Tipe."}{" "}
                    Pemisah boleh koma, titik koma, atau tab. Terdeteksi {parsedStudents.length}{" "}
                    pemilih. Maksimal {MAX_TOKEN_BATCH_SIZE} pemilih.
                  </span>
                </label>
              </>
            ) : (
              <label className="block flex-1">
                <span className="text-sm font-semibold text-neutral-800">Jumlah token</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_TOKEN_BATCH_SIZE}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
                />
                <span className="mt-2 block text-xs font-medium text-neutral-500">
                  Maksimal {MAX_TOKEN_BATCH_SIZE} token per batch.
                </span>
              </label>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGeneratorOpen(false)}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  !canGenerate ||
                  generating ||
                  (activeGeneratorMode === "students" && parsedStudents.length === 0)
                }
                className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
              >
                {generating ? "Generate..." : "Generate"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {emailEditTarget ? (
        <Modal
          title="Ubah Email Pemilih"
          onClose={() => {
            if (!savingEmail) {
              setEmailEditTarget(null);
            }
          }}
        >
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-neutral-950">
                {emailEditTarget.studentName ?? "Pemilih tanpa nama"}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {emailEditTarget.studentIdentifier ?? voterTypeLabel(emailEditTarget.voterType)}
              </p>
            </div>

            <Alert tone="info" title="Status pengiriman akan direset">
              Setelah email disimpan, status email token dan reminder kembali menjadi belum dikirim.
              Token voting tetap sama dan tidak ada token baru yang dibuat.
            </Alert>

            {emailEditError ? (
              <Alert tone="danger" title="Email gagal diperbarui">
                {emailEditError}
              </Alert>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-neutral-800">Email baru</span>
              <input
                type="email"
                value={editedEmail}
                onChange={(event) => {
                  setEditedEmail(event.target.value);
                  setEmailEditError(null);
                }}
                required
                maxLength={255}
                autoComplete="email"
                disabled={savingEmail !== null}
                aria-invalid={Boolean(emailEditError)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] disabled:bg-neutral-100"
              />
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEmailEditTarget(null)}
                disabled={savingEmail !== null}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void saveTokenEmail(false)}
                disabled={savingEmail !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                {savingEmail === "save" ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Pencil aria-hidden="true" className="size-4" />
                )}
                {savingEmail === "save" ? "Menyimpan" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => void saveTokenEmail(true)}
                disabled={savingEmail !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60"
              >
                {savingEmail === "send" ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="size-4" />
                )}
                {savingEmail === "send" ? "Mengirim" : "Simpan & Kirim Token"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {resendTarget ? (
        <Modal title="Kirim Ulang Token" onClose={() => setResendTarget(null)}>
          <p className="text-sm leading-6 text-neutral-600">
            Kirim ulang token yang sama untuk{" "}
            <strong>{resendTarget.studentName ?? "pemilih"}</strong> ke{" "}
            <strong>{resendTarget.studentEmail}</strong>? Pengiriman sebelumnya tetap tercatat dan
            token baru tidak akan dibuat.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setResendTarget(null)}
              disabled={resendingEmail}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void resendSentEmail()}
              disabled={resendingEmail}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${resendingEmail ? "animate-spin" : ""}`}
              />
              {resendingEmail ? "Mengirim..." : "Kirim Ulang"}
            </button>
          </div>
        </Modal>
      ) : null}

      {generated ? (
        <Modal
          title={`${generated.generatedCount} Token Berhasil Dibuat`}
          onClose={() => setGenerated(null)}
        >
          <Alert tone="warning" title="Token plaintext disembunyikan">
            Token plaintext tidak ditampilkan dan tidak didownload dari dashboard. Cek tabel status
            untuk melihat email terkirim/gagal dan gunakan Retry Email Gagal bila perlu. Jika Google
            Sheets aktif, status pemilih juga akan disinkronkan ke spreadsheet.
          </Alert>
          {generated.sheetsSync ? (
            <div className="mt-4">
              <Alert
                tone={generated.sheetsSync.status === "SYNCED" ? "success" : "warning"}
                title={
                  generated.sheetsSync.status === "SYNCED"
                    ? "Google Spreadsheet tersinkron"
                    : "Google Spreadsheet belum tersinkron"
                }
              >
                {generated.sheetsSync.error ?? "Data pemilih sudah masuk ke spreadsheet election."}
                {generated.sheetsSync.spreadsheetUrl ? (
                  <a
                    href={generated.sheetsSync.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 font-semibold underline"
                  >
                    Buka Spreadsheet
                  </a>
                ) : null}
              </Alert>
            </div>
          ) : null}
          {generated.emailSummary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Stat label="Email terkirim" value={String(generated.emailSummary.sent)} />
              <Stat label="Email gagal" value={String(generated.emailSummary.failed)} />
              <Stat label="Email dilewati" value={String(generated.emailSummary.skipped)} />
              <Stat label="Email antre" value={String(generated.emailSummary.pending)} />
            </div>
          ) : null}
          <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
            {generated.assignedTokens?.length ? (
              generated.assignedTokens.map((assignment) => (
                <p
                  key={`${assignment.studentIdentifier ?? assignment.studentName}-${assignment.studentEmail ?? ""}`}
                >
                  {assignment.studentIdentifier ? `${assignment.studentIdentifier} | ` : ""}
                  {assignment.studentName} | {assignment.studentEmail ?? "-"} |{" "}
                  {voterTypeLabel(assignment.voterType)} |{" "}
                  {emailAssignmentLabel(assignment.emailStatus)}
                </p>
              ))
            ) : (
              <p>{generated.generatedCount} token berhasil dibuat.</p>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenerated(null)}
              className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)]"
            >
              Tutup
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-neutral-950">{value}</p>
    </div>
  );
}

export function parseStudents(
  value: string,
  weightedMode: boolean,
  strict = false,
): ParsedStudent[] {
  const result = Papa.parse<string[]>(value.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    transform: (cell) => cell.trim(),
  });

  if (strict && result.errors.length > 0) {
    const firstError = result.errors[0];
    const row = firstError?.row === undefined ? "" : ` pada baris ${firstError.row + 1}`;
    throw new Error(`Format CSV tidak valid${row}: ${firstError?.message ?? "gagal dibaca"}.`);
  }

  const rows = result.data.filter((cells) => cells.some(Boolean));
  const firstRow = rows[0];
  if (!firstRow) {
    return [];
  }

  if (isVoterHeaderRow(firstRow)) {
    const headers = firstRow.map(normalizeHeader);
    return rows
      .slice(1)
      .map((row) =>
        parseSpreadsheetRow(
          Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
          weightedMode,
        ),
      )
      .filter((row) => row !== null);
  }

  return rows.reduce<ParsedStudent[]>((students, cells) => {
    const [studentIdentifier, studentName, studentClass, studentEmail, voterType] = weightedMode
      ? [undefined, cells[0], cells[1], cells[2], cells[3]]
      : cells;

    if ((!weightedMode && !studentIdentifier) || !studentName) {
      return students;
    }

    students.push({
      ...(studentIdentifier ? { studentIdentifier } : {}),
      studentName,
      ...(studentClass ? { studentClass } : {}),
      ...(studentEmail ? { studentEmail } : {}),
      voterType: normalizeVoterType(voterType, weightedMode),
    });

    return students;
  }, []);
}

function isVoterHeaderRow(row: string[]) {
  const headers = new Set(row.map(normalizeHeader));
  return (
    ["student_name", "nama", "name"].some((header) => headers.has(header)) &&
    ["student_email", "email", "mail"].some((header) => headers.has(header))
  );
}

function parseSpreadsheetRow(
  row: Record<string, unknown>,
  weightedMode: boolean,
): ParsedStudent | null {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value).trim()]),
  );
  const studentIdentifier =
    pickValue(normalized, ["student_identifier", "nis", "id", "nomor_induk", "identifier"]) ?? "";
  const studentName = pickValue(normalized, ["student_name", "nama", "name"]) ?? "";
  const studentClass =
    pickValue(normalized, ["student_class", "kelas", "class", "jabatan"]) ?? undefined;
  const studentEmail = pickValue(normalized, ["student_email", "email", "mail"]) ?? undefined;
  const voterType = pickValue(normalized, ["voter_type", "role", "tipe", "pembeda"]);

  if ((!weightedMode && !studentIdentifier) || !studentName) {
    return null;
  }

  return {
    ...(studentIdentifier ? { studentIdentifier } : {}),
    studentName,
    ...(studentClass ? { studentClass } : {}),
    ...(studentEmail ? { studentEmail } : {}),
    voterType: normalizeVoterType(voterType, weightedMode),
  };
}

async function parseExcelFile(file: File, weightedMode: boolean) {
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  const [headers, ...bodyRows] = rows;
  if (!headers) {
    return [];
  }

  const normalizedHeaders = headers.map((header: unknown) => normalizeHeader(String(header ?? "")));
  return bodyRows
    .map((row: unknown[]) =>
      parseSpreadsheetRow(
        Object.fromEntries(
          normalizedHeaders.map((header: string, index: number) => [
            header,
            String(row[index] ?? "").trim(),
          ]),
        ),
        weightedMode,
      ),
    )
    .filter((row) => row !== null);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}

function pickValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function formatStudentLine(student: ParsedStudent) {
  const voterType = voterTypeLabel(student.voterType).toUpperCase();
  const cells = student.studentIdentifier
    ? [
        student.studentIdentifier,
        student.studentName,
        student.studentClass ?? "",
        student.studentEmail ?? "",
        voterType,
      ]
    : [student.studentName, student.studentClass ?? "", student.studentEmail ?? "", voterType];

  return Papa.unparse([cells], { newline: "\n" });
}

function statusLabel(status: TokenStatusFilter) {
  if (status === "used") {
    return "Dipakai";
  }

  if (status === "unused") {
    return "Belum";
  }

  return "Semua";
}

function normalizeVoterType(value?: string, weightedMode = false): VoterType {
  const normalized = value?.trim().toLowerCase();
  if (weightedMode) {
    if (normalized === "osis") {
      return "OSIS";
    }
    if (normalized === "mpk") {
      return "MPK";
    }
    if (normalized === "guru" || normalized === "teacher") {
      return "GURU";
    }
    return "STUDENT";
  }
  return normalized === "guru" || normalized === "teacher" ? "TEACHER" : "STUDENT";
}

function voterTypeLabel(value?: VoterType | null) {
  if (value === "TEACHER" || value === "GURU") {
    return "Guru";
  }
  if (value === "OSIS") {
    return "OSIS";
  }
  if (value === "MPK") {
    return "MPK";
  }
  return "Siswa";
}

function emailAssignmentLabel(status?: TokenAssignment["emailStatus"]) {
  if (status === "PENDING") {
    return "DIANTREKAN";
  }
  return status ?? "DILEWATI";
}

function emailTone(token: TokenMetadata) {
  if (token.emailSentAt) {
    return "success";
  }

  if (token.emailError) {
    return "danger";
  }

  return "neutral";
}

function reminderTone(token: TokenMetadata) {
  if (token.reminderSentAt) {
    return "success";
  }

  if (token.usedAt) {
    return "neutral";
  }

  if (token.reminderError) {
    return "danger";
  }

  return "neutral";
}

function reminderLabel(token: TokenMetadata, electionStatus: ElectionDetail["status"]) {
  if (token.reminderSentAt) {
    return "Terkirim";
  }
  if (token.usedAt) {
    return "Tidak perlu";
  }
  if (!token.emailSentAt) {
    return "Belum tersedia";
  }
  if (token.reminderError) {
    return "Gagal";
  }
  if (electionStatus === "OPEN") {
    return "Antre";
  }
  return "Belum";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
