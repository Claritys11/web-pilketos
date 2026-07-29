"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge, resultTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonTable } from "@/components/common/Skeleton";
import { adminFetch, buildQuery } from "@/lib/admin/api";
import type { AuditLogItem, AuditResult, Paginated } from "@/lib/admin/types";

export function AuditClient({ initialTargetId }: { initialTargetId?: string }) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [result, setResult] = useState<"" | AuditResult>("");
  const [targetId, setTargetId] = useState(initialTargetId ?? "");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminFetch<Paginated<AuditLogItem>>(
        `/api/admin/audit${buildQuery({
          page,
          pageSize: 20,
          "filterBy[action]": action || undefined,
          "filterBy[actorId]": actorId || undefined,
          "filterBy[result]": result || undefined,
          "filterBy[targetId]": targetId || undefined,
          "filterBy[createdFrom]": createdFrom || undefined,
          "filterBy[createdTo]": createdTo || undefined,
        })}`,
      );
      setItems(data.items);
      setTotalPages(data.pagination.totalPages || 1);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat audit log.");
    } finally {
      setLoading(false);
    }
  }, [action, actorId, createdFrom, createdTo, page, result, targetId]);

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-indigo-700">Audit</p>
        <h2 className="mt-1 text-2xl font-bold text-neutral-950">Audit Log</h2>
      </div>

      <section className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          placeholder="Action"
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          value={actorId}
          onChange={(event) => {
            setActorId(event.target.value);
            setPage(1);
          }}
          placeholder="Actor ID"
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <select
          value={result}
          onChange={(event) => {
            setResult(event.target.value as typeof result);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm"
        >
          <option value="">Semua Result</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>
        <input
          value={targetId}
          onChange={(event) => {
            setTargetId(event.target.value);
            setPage(1);
          }}
          placeholder="Target ID"
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          type="date"
          value={createdFrom}
          onChange={(event) => {
            setCreatedFrom(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          type="date"
          value={createdTo}
          onChange={(event) => {
            setCreatedTo(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setAction("");
            setActorId("");
            setResult("");
            setTargetId("");
            setCreatedFrom("");
            setCreatedTo("");
            setPage(1);
          }}
          className="h-11 rounded-lg border border-neutral-200 text-sm font-semibold md:col-span-6"
        >
          Reset
        </button>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <SkeletonTable columns={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas"
          description="Audit log akan muncul setelah ada aktivitas admin."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <FragmentRow
                  key={item.id}
                  item={item}
                  expanded={expanded === item.id}
                  onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
                />
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
    </div>
  );
}

function FragmentRow({
  item,
  expanded,
  onToggle,
}: {
  item: AuditLogItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
        onClick={onToggle}
      >
        <td className="px-4 py-4">{new Date(item.createdAt).toLocaleString("id-ID")}</td>
        <td className="px-4 py-4">{item.actor?.username ?? item.actorId ?? "System"}</td>
        <td className="px-4 py-4 font-semibold text-neutral-800">{item.action}</td>
        <td className="px-4 py-4 text-neutral-600">
          {item.targetType ?? "-"} {item.targetId ?? ""}
        </td>
        <td className="px-4 py-4">
          <Badge tone={resultTone(item.result)}>{item.result}</Badge>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-neutral-100 bg-neutral-50">
          <td colSpan={5} className="px-4 py-4">
            <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-950 p-4 text-xs text-neutral-100">
              {JSON.stringify(
                { metadata: item.metadata, ipAddress: item.ipAddress, userAgent: item.userAgent },
                null,
                2,
              )}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
