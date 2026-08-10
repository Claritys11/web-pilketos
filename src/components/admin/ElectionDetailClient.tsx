"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Alert } from "@/components/common/Alert";
import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SkeletonCard } from "@/components/common/Skeleton";
import {
  DEFAULT_REMINDER_EMAIL_MESSAGE,
  DEFAULT_REMINDER_EMAIL_SUBJECT,
  DEFAULT_TOKEN_EMAIL_MESSAGE,
  DEFAULT_TOKEN_EMAIL_SUBJECT,
  EMAIL_TEMPLATE_HELP,
} from "@/config/email-templates";
import { adminFetch } from "@/lib/admin/api";
import type { AdminSessionUser, ElectionDetail, ElectionStatus } from "@/lib/admin/types";

const NEXT_ACTIONS: Partial<
  Record<ElectionStatus, Array<{ status: ElectionStatus; label: string; danger?: boolean }>>
> = {
  SETUP: [{ status: "READY", label: "Tandai Siap" }],
  READY: [{ status: "OPEN", label: "Buka Voting" }],
  OPEN: [
    { status: "PAUSED", label: "Jeda Voting" },
    { status: "CLOSED", label: "Tutup Voting", danger: true },
  ],
  PAUSED: [
    { status: "OPEN", label: "Lanjutkan Voting" },
    { status: "CLOSED", label: "Tutup Voting", danger: true },
  ],
  CLOSED: [{ status: "ARCHIVED", label: "Arsipkan" }],
};

export function ElectionDetailClient({
  electionId,
  user,
}: {
  electionId: string;
  user: AdminSessionUser;
}) {
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ElectionStatus | null>(null);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [startingReminder, setStartingReminder] = useState<"PENDING" | "FAILED" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailTemplates, setEmailTemplates] = useState({
    tokenEmailSubject: DEFAULT_TOKEN_EMAIL_SUBJECT,
    tokenEmailMessage: DEFAULT_TOKEN_EMAIL_MESSAGE,
    reminderEmailSubject: DEFAULT_REMINDER_EMAIL_SUBJECT,
    reminderEmailMessage: DEFAULT_REMINDER_EMAIL_MESSAGE,
  });
  const canManage = user.role !== "VIEWER";

  const actions = useMemo(
    () => (election ? (NEXT_ACTIONS[election.status] ?? []) : []),
    [election],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}`);
      setElection(data);
      setEmailTemplates({
        tokenEmailSubject: data.tokenEmailSubject ?? DEFAULT_TOKEN_EMAIL_SUBJECT,
        tokenEmailMessage: data.tokenEmailMessage ?? DEFAULT_TOKEN_EMAIL_MESSAGE,
        reminderEmailSubject: data.reminderEmailSubject ?? DEFAULT_REMINDER_EMAIL_SUBJECT,
        reminderEmailMessage: data.reminderEmailMessage ?? DEFAULT_REMINDER_EMAIL_MESSAGE,
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat detail election.");
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

  useEffect(() => {
    if (!election || election.status !== "OPEN" || election.reminderSummary.pending === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}`)
        .then(setElection)
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [election, electionId]);

  useEffect(() => {
    if (!error && !notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setError(null);
      setNotice(null);
    }, 7000);
    return () => window.clearTimeout(timeout);
  }, [error, notice]);

  async function transitionStatus() {
    if (!pendingStatus) {
      return;
    }

    try {
      setError(null);
      await adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: pendingStatus }),
      });
      if (pendingStatus === "OPEN") {
        setNotice("Voting dibuka. Reminder untuk pemilih yang belum voting mulai dikirim.");
      }
      setPendingStatus(null);
      await load();
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Gagal mengubah status election.",
      );
      setPendingStatus(null);
    }
  }

  async function saveEmailTemplates() {
    setSavingTemplates(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/elections/${electionId}`, {
        method: "PATCH",
        body: JSON.stringify(emailTemplates),
      });
      setNotice("Template email token dan reminder berhasil disimpan.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan template email.");
    } finally {
      setSavingTemplates(false);
    }
  }

  async function startReminder(mode: "PENDING" | "FAILED") {
    setStartingReminder(mode);
    setError(null);
    setNotice(null);
    try {
      await adminFetch("/api/admin/tokens/reminder", {
        method: "POST",
        body: JSON.stringify({ electionId, mode }),
      });
      setNotice(
        mode === "FAILED"
          ? "Reminder gagal dimasukkan kembali ke antrean."
          : "Pengiriman reminder tertunda dilanjutkan.",
      );
      await load();
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : "Gagal memulai reminder.");
    } finally {
      setStartingReminder(null);
    }
  }

  async function syncGoogleSheet() {
    setSyncingSheet(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/elections/${electionId}/google-sheet`, { method: "POST" });
      setNotice("Google Spreadsheet berhasil disinkronkan.");
      await load();
    } catch (syncError) {
      const message =
        syncError instanceof Error ? syncError.message : "Sinkronisasi Spreadsheet gagal.";
      await load();
      setError(message);
    } finally {
      setSyncingSheet(false);
    }
  }

  if (loading) {
    return <SkeletonCard />;
  }

  if (!election) {
    return (
      <EmptyState title="Election tidak ditemukan" description={error ?? "Data tidak tersedia."} />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/elections"
        className="text-sm font-semibold text-[var(--color-primary-700)] hover:underline"
      >
        Kembali ke Elections
      </Link>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <AdminPageHeader
          eyebrow="Detail election"
          title={election.title}
          description={election.description || "Tanpa deskripsi."}
        >
          <Badge tone={electionStatusTone(election.status)}>{election.status}</Badge>
        </AdminPageHeader>
        <p className="mt-4 text-xs text-neutral-500">
          Dibuat oleh {election.createdBy?.username ?? "-"} pada{" "}
          {new Date(election.createdAt).toLocaleString("id-ID")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Badge tone="primary">
            {election.mode === "WEIGHTED_FIVE" ? "5 kandidat berbobot" : "Kandidat bebas"}
          </Badge>
          {election.mode === "WEIGHTED_FIVE" ? (
            <span className="text-neutral-600">OSIS 40% · MPK 30% · GURU 30%</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-3 border-b border-neutral-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Email Token dan Reminder</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">
              Edit subjek dan pesan pembuka untuk election ini. Bagian penting email tetap
              ditambahkan otomatis dan terlihat pada pratinjau lengkap di bawah form.
            </p>
            <p className="mt-2 text-xs font-medium text-neutral-500">{EMAIL_TEMPLATE_HELP}</p>
          </div>
          {canManage && !["CLOSED", "ARCHIVED"].includes(election.status) ? (
            <button
              type="button"
              onClick={() => void saveEmailTemplates()}
              disabled={savingTemplates}
              className="h-10 shrink-0 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
            >
              {savingTemplates ? "Menyimpan..." : "Simpan Template"}
            </button>
          ) : null}
        </div>

        <fieldset
          disabled={!canManage || ["CLOSED", "ARCHIVED"].includes(election.status)}
          className="mt-5 grid gap-6 lg:grid-cols-2 disabled:opacity-70"
        >
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase text-[var(--color-primary-700)]">
              Email token awal
            </h4>
            <TemplateField
              label="Subjek email (editable)"
              value={emailTemplates.tokenEmailSubject}
              onChange={(value) =>
                setEmailTemplates((current) => ({ ...current, tokenEmailSubject: value }))
              }
              maxLength={200}
            />
            <TemplateField
              label="Pesan pembuka (editable)"
              value={emailTemplates.tokenEmailMessage}
              onChange={(value) =>
                setEmailTemplates((current) => ({ ...current, tokenEmailMessage: value }))
              }
              multiline
              maxLength={4000}
            />
            <EmailPreview
              kind="TOKEN"
              subject={emailTemplates.tokenEmailSubject}
              message={emailTemplates.tokenEmailMessage}
              electionTitle={election.title}
            />
          </div>
          <div className="space-y-4 lg:border-l lg:border-neutral-200 lg:pl-6">
            <h4 className="text-sm font-semibold uppercase text-[var(--color-primary-700)]">
              Reminder saat voting dibuka
            </h4>
            <TemplateField
              label="Subjek email (editable)"
              value={emailTemplates.reminderEmailSubject}
              onChange={(value) =>
                setEmailTemplates((current) => ({ ...current, reminderEmailSubject: value }))
              }
              maxLength={200}
            />
            <TemplateField
              label="Pesan pembuka (editable)"
              value={emailTemplates.reminderEmailMessage}
              onChange={(value) =>
                setEmailTemplates((current) => ({ ...current, reminderEmailMessage: value }))
              }
              multiline
              maxLength={4000}
            />
            <EmailPreview
              kind="REMINDER"
              subject={emailTemplates.reminderEmailSubject}
              message={emailTemplates.reminderEmailMessage}
              electionTitle={election.title}
            />
          </div>
        </fieldset>

        <div className="mt-6 border-t border-neutral-200 pt-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-neutral-950">Status reminder</h4>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <ReminderStat label="Layak" value={election.reminderSummary.eligible} />
                <ReminderStat label="Antre" value={election.reminderSummary.pending} />
                <ReminderStat label="Terkirim" value={election.reminderSummary.sent} />
                <ReminderStat label="Gagal" value={election.reminderSummary.failed} danger />
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Hanya pemilih yang sudah menerima email token dan belum voting yang diingatkan.
                Reminder otomatis dimulai saat election pertama kali dibuka.
              </p>
            </div>
            {canManage && election.status === "OPEN" ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void startReminder("PENDING")}
                  disabled={startingReminder !== null || election.reminderSummary.pending === 0}
                  className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {startingReminder === "PENDING" ? "Memulai..." : "Lanjutkan Antrean"}
                </button>
                <button
                  type="button"
                  onClick={() => void startReminder("FAILED")}
                  disabled={startingReminder !== null || election.reminderSummary.failed === 0}
                  className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
                >
                  {startingReminder === "FAILED" ? "Mengantrekan..." : "Retry Reminder Gagal"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Google Spreadsheet</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Status pemilih dan konfirmasi voting disinkronkan ke spreadsheet election ini.
            </p>
            {election.googleSheetsSyncError ? (
              <p className="mt-3 max-w-3xl text-sm text-red-700">
                Sync terakhir gagal: {election.googleSheetsSyncError}
              </p>
            ) : election.googleSheetsSyncedAt ? (
              <p className="mt-3 text-sm text-emerald-700">
                Terakhir sinkron: {new Date(election.googleSheetsSyncedAt).toLocaleString("id-ID")}
              </p>
            ) : (
              <p className="mt-3 text-sm text-amber-700">Belum pernah berhasil disinkronkan.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {election.googleSheetsSpreadsheetId ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(election.googleSheetsSpreadsheetId)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Buka Spreadsheet
              </a>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => void syncGoogleSheet()}
                disabled={syncingSheet || (election._count?.tokens ?? 0) === 0}
                className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {syncingSheet ? "Menyinkronkan..." : "Sinkronkan Sekarang"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">Kontrol Status</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Ikuti urutan status agar voting tidak dibuka sebelum kandidat dan token siap.
            </p>
          </div>
          {canManage && actions.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {actions.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  onClick={() => setPendingStatus(action.status)}
                  className={`h-10 rounded-lg px-4 text-sm font-semibold text-white ${
                    action.danger
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-[var(--color-vote-primary)] hover:bg-[var(--color-primary-700)]"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-neutral-500">
              {canManage
                ? "Tidak ada aksi status untuk state ini."
                : "Role VIEWER hanya dapat membaca data."}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Kandidat" value={String(election.candidates.length)} />
        <Stat label="Token" value={String(election._count?.tokens ?? 0)} />
        <Stat label="Suara" value={String(election._count?.votes ?? 0)} />
      </section>

      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm shadow-red-950/5">
        <h3 className="text-lg font-semibold text-neutral-950">Navigasi Election</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-[var(--color-primary-700)]">Ringkasan</p>
            <p className="mt-1 text-sm text-red-700">Status, prasyarat, dan statistik dasar.</p>
          </div>
          <Link
            className="rounded-lg border border-neutral-200 p-4 hover:bg-red-50/40"
            href={`/admin/elections/${election.id}/candidates`}
          >
            <p className="font-semibold text-neutral-950">Kandidat</p>
            <p className="mt-1 text-sm text-neutral-500">Kelola kandidat election ini.</p>
          </Link>
          <Link
            className="rounded-lg border border-neutral-200 p-4 hover:bg-red-50/40"
            href={`/admin/elections/${election.id}/tokens`}
          >
            <p className="font-semibold text-neutral-950">Token</p>
            <p className="mt-1 text-sm text-neutral-500">Generate dan export token.</p>
          </Link>
          <Link
            className="rounded-lg border border-neutral-200 p-4 hover:bg-red-50/40"
            href={`/admin/audit?targetId=${election.id}`}
          >
            <p className="font-semibold text-neutral-950">Audit</p>
            <p className="mt-1 text-sm text-neutral-500">Lihat log terkait election.</p>
          </Link>
        </div>
      </section>

      {pendingStatus ? (
        <Modal title="Konfirmasi Perubahan Status" onClose={() => setPendingStatus(null)}>
          <p className="text-sm leading-6 text-neutral-700">
            Ubah status election dari <strong>{election.status}</strong> ke{" "}
            <strong>{pendingStatus}</strong>?
          </p>
          {pendingStatus === "OPEN" ? (
            <div className="mt-4">
              <Alert tone="warning" title="Cek sebelum membuka voting">
                Sistem hanya mengizinkan satu election berstatus OPEN atau PAUSED. Jika masih ada
                election lain yang aktif, tutup atau arsipkan dulu election tersebut sebelum membuka
                voting ini.
                <span className="mt-2 block">
                  Setelah berhasil dibuka, sistem otomatis mengirim reminder kepada pemilih yang
                  sudah menerima token dan belum memberikan suara.
                </span>
              </Alert>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingStatus(null)}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void transitionStatus()}
              className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)]"
            >
              Ya, Ubah
            </button>
          </div>
        </Modal>
      ) : null}

      {error || notice ? (
        <ActionToast
          tone={error ? "danger" : "success"}
          message={error ?? notice ?? ""}
          onClose={() => {
            setError(null);
            setNotice(null);
          }}
        />
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

function TemplateField({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:border-[var(--color-vote-primary)] focus:ring-2 focus:ring-red-100";
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={6}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          className={className}
        />
      )}
      <span className="mt-1 block text-right text-xs text-neutral-400">
        {value.length}/{maxLength}
      </span>
    </label>
  );
}

function ReminderStat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <span className={danger && value > 0 ? "font-semibold text-red-700" : "text-neutral-600"}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function EmailPreview({
  kind,
  subject,
  message,
  electionTitle,
}: {
  kind: "TOKEN" | "REMINDER";
  subject: string;
  message: string;
  electionTitle: string;
}) {
  const values = { name: "Nama Pemilih", election: electionTitle };
  const renderedSubject = renderTemplatePreview(subject, values);
  const renderedMessage = renderTemplatePreview(message, values);

  return (
    <div className="border border-neutral-200 bg-neutral-50" aria-label="Pratinjau email lengkap">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">
            Pratinjau email lengkap
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-neutral-900">
            {renderedSubject || "Subjek email"}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500">
          <LockKeyhole aria-hidden="true" className="size-3.5" />
          Struktur aman
        </span>
      </div>
      <div className="space-y-4 p-4 text-sm leading-6 text-neutral-700">
        <p className="whitespace-pre-line">{renderedMessage || "Pesan pembuka admin"}</p>
        <div className="border-l-2 border-neutral-300 pl-3">
          <p className="text-xs font-semibold uppercase text-neutral-500">Ditambahkan sistem</p>
          <p className="mt-2">
            <strong>Token:</strong>{" "}
            <code className="rounded bg-neutral-200 px-1.5 py-0.5 font-semibold text-neutral-950">
              ABCD-EFGH-1234
            </code>
          </p>
          <span className="mt-3 inline-flex min-h-10 items-center bg-[var(--color-vote-primary)] px-4 font-semibold text-white">
            {kind === "REMINDER" ? "Buka Voting Sekarang" : "Buka Voting dan Isi Token Otomatis"}
          </span>
          <p className="mt-3 break-all text-xs text-sky-700 underline">
            https://domain-pilketos.example/vote?token=...
          </p>
          <p className="mt-3 text-xs text-neutral-600">
            Token hanya bisa dipakai satu kali. Jangan bagikan token kepada orang lain.
          </p>
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <p className="font-semibold text-neutral-800">Link atau website bermasalah?</p>
            <span className="mt-2 inline-flex min-h-9 items-center bg-emerald-600 px-3 text-xs font-semibold text-white">
              Hubungi Admin via WhatsApp
            </span>
            <p className="mt-2 text-xs text-neutral-500">
              Ditampilkan jika nomor WhatsApp support dikonfigurasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTemplatePreview(template: string, values: { name: string; election: string }) {
  return template.replace(/{{\s*(name|election)\s*}}/gi, (_match, key: string) => {
    return key.toLowerCase() === "name" ? values.name : values.election;
  });
}

function ActionToast({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "danger";
  message: string;
  onClose: () => void;
}) {
  const success = tone === "success";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
      className={`fixed bottom-4 left-4 right-4 z-[70] border p-4 shadow-xl sm:left-auto sm:right-6 sm:max-w-md ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-red-200 bg-red-50 text-red-950"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{success ? "Berhasil" : "Aksi tidak dapat diproses"}</p>
          <p className="mt-1 break-words text-sm leading-5">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Tutup notifikasi"
          aria-label="Tutup notifikasi"
          className="inline-flex size-8 shrink-0 items-center justify-center hover:bg-black/5"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
