"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SkeletonTable } from "@/components/common/Skeleton";
import { adminFetch, buildQuery } from "@/lib/admin/api";
import type {
  AdminSessionUser,
  ElectionListItem,
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
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
      });
      setTitle("");
      setDescription("");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-700">Manajemen</p>
          <h2 className="mt-1 text-2xl font-bold text-neutral-950">Elections</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Buat Election
          </button>
        ) : null}
      </div>

      <section className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari election..."
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? "Semua Status" : option}
            </option>
          ))}
        </select>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
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
                className="font-semibold text-indigo-700"
              >
                Buat Election Pertama
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Kandidat</th>
                <th className="px-4 py-3 text-left">Token</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-neutral-950">{item.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(item.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={electionStatusTone(item.status)}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-4 text-neutral-700">{item._count?.candidates ?? 0}</td>
                  <td className="px-4 py-4 text-neutral-700">{item._count?.tokens ?? 0}</td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      className="font-semibold text-indigo-700 hover:underline"
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
              <label htmlFor="title" className="text-sm font-semibold text-neutral-800">
                Judul
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
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
