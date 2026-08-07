"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Alert } from "@/components/common/Alert";
import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SkeletonCard } from "@/components/common/Skeleton";
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
  const canManage = user.role !== "VIEWER";

  const actions = useMemo(
    () => (election ? (NEXT_ACTIONS[election.status] ?? []) : []),
    [election],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setElection(await adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}`));
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
      setPendingStatus(null);
      await load();
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Gagal mengubah status election.",
      );
      setPendingStatus(null);
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

      {error ? (
        <Alert tone="danger" title="Aksi tidak bisa diproses">
          {error}
        </Alert>
      ) : null}

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
