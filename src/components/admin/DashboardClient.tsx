"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonCard } from "@/components/common/Skeleton";
import { useDashboardPolling } from "@/components/admin/useDashboardPolling";
import { adminFetch, buildQuery } from "@/lib/admin/api";
import type {
  AdminSessionUser,
  DashboardStats,
  ElectionListItem,
  Paginated,
} from "@/lib/admin/types";

function timeLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "-";
}

export function DashboardClient({ user }: { user: AdminSessionUser }) {
  const [elections, setElections] = useState<ElectionListItem[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  const selectedElection = useMemo(
    () => elections.find((election) => election.id === selectedElectionId) ?? elections[0] ?? null,
    [elections, selectedElectionId],
  );

  const loadElections = useCallback(async () => {
    const data = await adminFetch<Paginated<ElectionListItem>>("/api/admin/elections?pageSize=100");
    const items = data.items;
    setElections(items);
    const preferred =
      items.find((item) => item.status === "OPEN") ??
      items.find((item) => item.status === "PAUSED") ??
      items.find((item) => item.status === "READY") ??
      items[0] ??
      null;
    setSelectedElectionId((current) => current || preferred?.id || "");
    return preferred?.id || "";
  }, []);

  const loadStats = useCallback(async (electionId: string, background = false) => {
    if (!electionId) {
      setStats(null);
      return;
    }
    if (background) {
      setPolling(true);
    } else {
      setLoading(true);
    }
    try {
      setError(null);
      setStats(
        await adminFetch<DashboardStats>(`/api/admin/dashboard/stats${buildQuery({ electionId })}`),
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat dashboard.");
    } finally {
      setLoading(false);
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) {
        return;
      }
      void loadElections()
        .then((electionId) => {
          if (active) {
            return loadStats(electionId);
          }
          return undefined;
        })
        .catch((fetchError: unknown) => {
          setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat data.");
          setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [loadElections, loadStats]);

  useEffect(() => {
    if (!selectedElectionId) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void loadStats(selectedElectionId);
      }
    });
    return () => {
      active = false;
    };
  }, [loadStats, selectedElectionId]);

  useDashboardPolling(() => {
    void loadStats(selectedElectionId, true);
  }, Boolean(selectedElectionId));

  if (liveMode && stats) {
    return (
      <main className="min-h-[calc(100vh-8rem)] bg-neutral-950 p-6 text-white">
        <div className="flex items-center justify-between">
          <Badge tone="danger">LIVE MODE</Badge>
        </div>
        <section className="mt-10">
          <p className="text-sm font-semibold text-indigo-200">{stats.election.title}</p>
          <h1 className="mt-2 text-4xl font-bold">{stats.totalVotes} suara masuk</h1>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Stat label="Partisipasi" value={`${stats.participationRate}%`} dark />
            <Stat label="Token digunakan" value={String(stats.usedTokens)} dark />
            <Stat
              label="Sisa token"
              value={String(Math.max(stats.totalTokens - stats.usedTokens, 0))}
              dark
            />
          </div>
          <CandidateBars stats={stats} dark />
          <p className="mt-8 text-sm text-neutral-300">
            Terakhir diperbarui: {timeLabel(stats.generatedAt)}
          </p>
        </section>
        <button
          type="button"
          onClick={() => setLiveMode(false)}
          className="fixed bottom-6 right-6 h-11 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-semibold backdrop-blur hover:bg-white/15"
        >
          Exit Live Mode
        </button>
      </main>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-700">Monitoring</p>
          <h2 className="mt-1 text-2xl font-bold text-neutral-950">Dashboard</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedElectionId}
            onChange={(event) => setSelectedElectionId(event.target.value)}
            className="h-11 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700"
          >
            {elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selectedElectionId && void loadStats(selectedElectionId)}
            className="h-11 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {polling ? "Memuat..." : "Refresh"}
          </button>
          {user.role !== "VIEWER" ? (
            <button
              type="button"
              onClick={() => setLiveMode(true)}
              disabled={!stats}
              className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Live Mode
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !selectedElection || !stats ? (
        <EmptyState
          title="Tidak ada pemilihan untuk ditampilkan"
          description="Buat election terlebih dahulu, tambah kandidat, lalu generate token."
          action={
            user.role !== "VIEWER" ? (
              <Link className="font-semibold text-indigo-700" href="/admin/elections">
                Buka Elections
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-neutral-950">{stats.election.title}</h3>
              <Badge tone={electionStatusTone(stats.election.status)}>
                {stats.election.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Terakhir diperbarui: {timeLabel(stats.generatedAt)}
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Total suara" value={String(stats.totalVotes)} />
            <Stat label="Partisipasi" value={`${stats.participationRate}%`} />
            <Stat
              label="Sisa token"
              value={String(Math.max(stats.totalTokens - stats.usedTokens, 0))}
            />
          </div>

          <CandidateBars stats={stats} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-5 shadow-sm ${dark ? "border-white/10 bg-white/10" : "border-neutral-200 bg-white"}`}
    >
      <p className={`text-sm font-medium ${dark ? "text-neutral-300" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

function CandidateBars({ stats, dark = false }: { stats: DashboardStats; dark?: boolean }) {
  return (
    <section
      className={`mt-6 rounded-lg border p-5 shadow-sm ${dark ? "border-white/10 bg-white/10" : "border-neutral-200 bg-white"}`}
    >
      <h3 className="text-lg font-semibold">Hasil per kandidat</h3>
      <div className="mt-5 space-y-4">
        {stats.candidateStats.map((candidate) => (
          <div key={candidate.candidateId}>
            <div className="flex items-center justify-between gap-4 text-sm font-semibold">
              <span>
                No. {candidate.orderNumber} {candidate.name}
              </span>
              <span>
                {candidate.voteCount} suara ({candidate.percentage}%)
              </span>
            </div>
            <div
              className={`mt-2 h-3 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-neutral-100"}`}
            >
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: `${Math.min(candidate.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
