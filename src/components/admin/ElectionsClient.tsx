"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Alert } from "@/components/common/Alert";
import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SkeletonTable } from "@/components/common/Skeleton";
import { adminFetch, buildQuery } from "@/lib/admin/api";
import type {
  AdminSessionUser,
  ElectionListItem,
  ElectionMode,
  ElectionStatus,
  Paginated,
} from "@/lib/admin/types";

const STATUS_OPTIONS: Array<"ALL" | ElectionStatus> = [
  "ALL",
  "SETUP",
  "READY",
  "OPEN",
  "PAUSED",
  "CLOSED",
  "ARCHIVED",
];

export function ElectionsClient({ user }: { user: AdminSessionUser }) {
  const [items, setItems] = useState<ElectionListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"ALL" | ElectionStatus>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<ElectionMode>("STANDARD");
  const canManage = user.role !== "VIEWER";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminFetch<Paginated<ElectionListItem>>(
        `/api/admin/elections${buildQuery({
          page,
          pageSize: 10,
          "filterBy[status]": status === "ALL" ? undefined : status,
        })}`,
      );
      setItems(data.items);
      setTotalPages(data.pagination.totalPages || 1);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat elections.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, search]);

  async function createElection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Judul election wajib diisi.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await adminFetch<ElectionListItem>("/api/admin/elections", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          mode,
        }),
      });
      setTitle("");
      setDescription("");
      setMode("STANDARD");
      setCreating(false);
      setStatus("ALL");
      setPage(1);
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setNotice(`Election "${created.title}" berhasil dibuat.`);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Election gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Manajemen"
        title="Elections"
        description="Buat election, cek kesiapan kandidat/token, lalu buka voting hanya saat semua prasyarat sudah siap."
      >
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-11 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-700)]"
          >
            Buat Election
          </button>
        ) : null}
      </AdminPageHeader>

      <Alert tone="info" title="Alur cepat">
        Mulai dari SETUP, tambah minimal 2 kandidat, generate token, tandai READY, lalu buka OPEN
        saat hari pemilihan.
      </Alert>

      <section className="grid gap-3 rounded-lg border border-red-100 bg-white p-4 shadow-sm shadow-red-950/5 md:grid-cols-[1fr_180px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari election..."
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? "Semua Status" : option}
            </option>
          ))}
        </select>
      </section>

      {error ? (
        <Alert tone="danger" title="Elections gagal dimuat">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert tone="success" title="Berhasil">
          {notice}
        </Alert>
      ) : null}

      {loading ? (
        <SkeletonTable columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum ada election"
          description="Election yang dibuat akan muncul di sini."
          action={
            canManage ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="font-semibold text-[var(--color-primary-700)]"
              >
                Buat Election Pertama
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-red-100 bg-white shadow-sm shadow-red-950/5">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-red-50/70 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Kandidat</th>
                <th className="px-4 py-3 text-left">Token</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-red-50/40">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-neutral-950">{item.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(item.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={electionStatusTone(item.status)}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-4 text-neutral-700">
                    {item.mode === "WEIGHTED_FIVE" ? "5 kandidat berbobot" : "Kandidat bebas"}
                  </td>
                  <td className="px-4 py-4 text-neutral-700">{item._count?.candidates ?? 0}</td>
                  <td className="px-4 py-4 text-neutral-700">{item._count?.tokens ?? 0}</td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      className="font-semibold text-[var(--color-primary-700)] hover:underline"
                      href={`/admin/elections/${item.id}`}
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Halaman {page} dari {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="h-10 rounded-lg border border-neutral-200 px-3 text-sm font-semibold disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="h-10 rounded-lg border border-neutral-200 px-3 text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {creating ? (
        <Modal title="Buat Election Baru" onClose={() => setCreating(false)}>
          <form onSubmit={createElection} className="space-y-4">
            <div>
              <label htmlFor="mode" className="text-sm font-semibold text-neutral-800">
                Mode election
              </label>
              <select
                id="mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as ElectionMode)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
              >
                <option value="STANDARD">Kandidat bebas (perhitungan suara biasa)</option>
                <option value="WEIGHTED_FIVE">
                  Tepat 5 kandidat (OSIS 40%, MPK 30%, GURU 30%)
                </option>
              </select>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Mode tidak dapat diganti setelah election dibuat karena menentukan format pemilih
                dan cara hasil dihitung.
              </p>
            </div>
            <div>
              <label htmlFor="title" className="text-sm font-semibold text-neutral-800">
                Judul
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
              />
            </div>
            <div>
              <label htmlFor="description" className="text-sm font-semibold text-neutral-800">
                Deskripsi
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60"
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
