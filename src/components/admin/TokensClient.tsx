"use client";

import Link from "next/link";
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

type GeneratorMode = "count" | "students";
type TokenStatusFilter = "all" | "used" | "unused";

interface TokenAssignment {
  studentIdentifier: string;
  studentName: string;
  studentClass?: string | null;
  studentEmail?: string | null;
  voterType?: "STUDENT" | "TEACHER";
  emailStatus?: "SENT" | "FAILED" | "SKIPPED";
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
  };
}

interface TokenMetadata {
  id: string;
  studentIdentifier: string | null;
  studentName: string | null;
  studentClass: string | null;
  studentEmail: string | null;
  voterType: "STUDENT" | "TEACHER" | null;
  emailSentAt: string | null;
  emailError: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface ParsedStudent {
  studentIdentifier: string;
  studentName: string;
  studentClass?: string;
  studentEmail?: string;
  voterType: "STUDENT" | "TEACHER";
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
  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canGenerate = user.role !== "VIEWER" && election?.status === "SETUP";

  const parsedStudents = useMemo(() => parseStudents(studentInput), [studentInput]);
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
        generatorMode === "students"
          ? { electionId, students: parsedStudents }
          : { electionId, count };

      const result = await adminFetch<GenerateResult>("/api/admin/tokens/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setGenerated(result);
      await load();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal generate token.");
    } finally {
      setGenerating(false);
    }
  }

  async function retryFailedEmails() {
    setRetryingEmail(true);
    try {
      setError(null);
      const result = await adminFetch<{
        attempted: number;
        sent: number;
        failed: number;
        skipped: number;
      }>("/api/admin/tokens/retry-email", {
        method: "POST",
        body: JSON.stringify({ electionId }),
      });
      setImportMessage(
        `Retry selesai: ${result.sent} terkirim, ${result.failed} gagal, ${result.skipped} dilewati dari ${result.attempted} token.`,
      );
      await load();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal retry email token.");
    } finally {
      setRetryingEmail(false);
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
          ? parseStudents(await file.text())
          : await parseExcelFile(file);

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
          onClick={() => void retryFailedEmails()}
          disabled={!canGenerate || retryingEmail}
          className="h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {retryingEmail ? "Retry..." : "Retry Email Gagal"}
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
          label="Token bersiswa"
          value={String(tokens.filter((token) => token.studentIdentifier).length)}
        />
      </section>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Distribusi Token Per Pemilih</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Upload Excel/CSV berisi pemilih siswa dan guru, lalu sistem membuat satu token per
              identitas. Plaintext token tidak ditampilkan atau didownload dari admin; pengiriman
              dilakukan lewat email dan token gagal bisa di-retry dari server.
            </p>
          </div>
          <a
            href="/api/admin/tokens/import-template"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Download Template CSV
          </a>
        </div>
      </section>

      <section className="rounded-lg border border-red-100 bg-white shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-3 border-b border-red-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Status Token Siswa</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Menampilkan {filteredTokens.length} dari {tokens.length} token.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={tokenSearch}
              onChange={(event) => setTokenSearch(event.target.value)}
              placeholder="Cari NIS, nama, kelas, email"
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
                <th className="px-5 py-3">NIS/ID</th>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Kelas</th>
                <th className="px-5 py-3">Tipe</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Email token</th>
                <th className="px-5 py-3">Dipakai pada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredTokens.length > 0 ? (
                filteredTokens.map((token, index) => (
                  <tr key={token.id} className="hover:bg-red-50/40">
                    <td className="px-5 py-3 text-neutral-500">{index + 1}</td>
                    <td className="px-5 py-3 font-semibold text-neutral-950">
                      {token.studentIdentifier ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{token.studentName ?? "-"}</td>
                    <td className="px-5 py-3 text-neutral-700">{token.studentClass ?? "-"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={token.voterType === "TEACHER" ? "warning" : "neutral"}>
                        {token.voterType === "TEACHER" ? "Guru" : "Siswa"}
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
                    <td className="px-5 py-3 text-neutral-500">{formatDateTime(token.usedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-neutral-500">
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
                  generatorMode === "students"
                    ? "bg-white text-[var(--color-primary-700)] shadow-sm"
                    : "text-neutral-600"
                }`}
              >
                Per Siswa
              </button>
              <button
                type="button"
                onClick={() => setGeneratorMode("count")}
                className={`h-10 rounded-md text-sm font-semibold ${
                  generatorMode === "count"
                    ? "bg-white text-[var(--color-primary-700)] shadow-sm"
                    : "text-neutral-600"
                }`}
              >
                Jumlah Biasa
              </button>
            </div>

            {generatorMode === "students" ? (
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
                    Header yang dikenali: student_identifier/nis/id, student_name/nama,
                    student_class/kelas, student_email/email, voter_type/role/tipe. Isi tipe dengan
                    siswa/guru. Email dikirim bertahap mengikuti batas server agar tidak mudah
                    terkena limit provider.
                  </span>
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
                      "12345,Nama Siswa,XII RPL 1,siswa@example.com,SISWA\nG001,Nama Guru,Guru,guru@example.com,GURU"
                    }
                    className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
                  />
                  <span className="mt-2 block text-xs font-medium text-neutral-500">
                    Format per baris: ID, Nama, Kelas/Jabatan, Email, Tipe. Pemisah boleh koma,
                    titik koma, atau tab. Terdeteksi {parsedStudents.length} pemilih. Maksimal{" "}
                    {MAX_TOKEN_BATCH_SIZE} pemilih.
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
                  (generatorMode === "students" && parsedStudents.length === 0)
                }
                className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
              >
                {generating ? "Generate..." : "Generate"}
              </button>
            </div>
          </form>
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
          {generated.emailSummary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Email terkirim" value={String(generated.emailSummary.sent)} />
              <Stat label="Email gagal" value={String(generated.emailSummary.failed)} />
              <Stat label="Email belum" value={String(generated.emailSummary.skipped)} />
            </div>
          ) : null}
          <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
            {generated.assignedTokens?.length ? (
              generated.assignedTokens.map((assignment) => (
                <p key={`${assignment.studentIdentifier}-${assignment.studentEmail ?? ""}`}>
                  {assignment.studentIdentifier} | {assignment.studentName} |{" "}
                  {assignment.studentEmail ?? "-"} | {voterTypeLabel(assignment.voterType)} |{" "}
                  {assignment.emailStatus ?? "SKIPPED"}
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

function parseStudents(value: string): ParsedStudent[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|;|,/).map((cell) => cell.trim()))
    .filter((cells) => {
      const firstCell = cells[0]?.toLowerCase();
      return cells.length >= 2 && firstCell !== "student_identifier" && firstCell !== "nis";
    })
    .reduce<ParsedStudent[]>((students, cells) => {
      const [studentIdentifier, studentName, studentClass, studentEmail, voterType] = cells;

      if (!studentIdentifier || !studentName) {
        return students;
      }

      students.push({
        studentIdentifier,
        studentName,
        ...(studentClass ? { studentClass } : {}),
        ...(studentEmail ? { studentEmail } : {}),
        voterType: normalizeVoterType(voterType),
      });

      return students;
    }, []);
}

function parseSpreadsheetRow(row: Record<string, unknown>): ParsedStudent | null {
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

  if (!studentIdentifier || !studentName) {
    return null;
  }

  return {
    studentIdentifier,
    studentName,
    ...(studentClass ? { studentClass } : {}),
    ...(studentEmail ? { studentEmail } : {}),
    voterType: normalizeVoterType(voterType),
  };
}

async function parseExcelFile(file: File) {
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

function formatStudentLine(student: ParsedStudent) {
  return [
    student.studentIdentifier,
    student.studentName,
    student.studentClass ?? "",
    student.studentEmail ?? "",
    student.voterType === "TEACHER" ? "GURU" : "SISWA",
  ].join(",");
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

function normalizeVoterType(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "guru" || normalized === "teacher" ? "TEACHER" : "STUDENT";
}

function voterTypeLabel(value?: "STUDENT" | "TEACHER" | null) {
  return value === "TEACHER" ? "Guru" : "Siswa";
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
