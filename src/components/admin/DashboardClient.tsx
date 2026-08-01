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

function numberLabel(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function percentLabel(value: number) {
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value)}%`;
}

async function requestDashboardFullscreen() {
  await document.documentElement.requestFullscreen?.().catch(() => undefined);
}

async function exitDashboardFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen?.().catch(() => undefined);
  }
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

  useDashboardPolling(
    () => {
      void loadStats(selectedElectionId, true);
    },
    Boolean(selectedElectionId),
    liveMode ? 2000 : 5000,
  );

  if (liveMode && stats) {
    return (
      <main className="min-h-[calc(100vh-8rem)] bg-neutral-950 p-5 text-white sm:p-8 lg:p-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.9)]" />
                <Badge tone="danger">LIVE MODE</Badge>
                <Badge tone={electionStatusTone(stats.election.status)}>
                  {stats.election.status}
                </Badge>
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-indigo-200">
                {stats.election.title}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                {numberLabel(stats.totalVotes)} suara masuk
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void requestDashboardFullscreen()}
                className="h-11 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
              >
                Fullscreen
              </button>
              <button
                type="button"
                onClick={() => {
                  setLiveMode(false);
                  void exitDashboardFullscreen();
                }}
                className="h-11 rounded-lg border border-white/15 bg-white px-4 text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
              >
                Exit Live Mode
              </button>
            </div>
          </div>

          <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-white/10 bg-white/10 p-6 shadow-sm">
              <p className="text-sm font-semibold text-neutral-300">Partisipasi</p>
              <div className="mt-6 grid place-items-center">
                <div
                  className="grid h-56 w-56 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#34d399 ${Math.min(stats.participationRate, 100)}%, rgba(255,255,255,0.12) 0)`,
                  }}
                >
                  <div className="grid h-40 w-40 place-items-center rounded-full bg-neutral-950 text-center">
                    <div>
                      <p className="text-4xl font-bold">{percentLabel(stats.participationRate)}</p>
                      <p className="mt-1 text-xs font-semibold uppercase text-neutral-400">
                        dari token
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat label="Token dipakai" value={numberLabel(stats.usedTokens)} dark compact />
                <Stat
                  label="Sisa token"
                  value={numberLabel(Math.max(stats.totalTokens - stats.usedTokens, 0))}
                  dark
                  compact
                />
              </div>
            </div>

            <CandidateBars stats={stats} dark ranked />
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <Stat label="Total token" value={numberLabel(stats.totalTokens)} dark />
            <Stat label="Token digunakan" value={numberLabel(stats.usedTokens)} dark />
            <Stat
              label="Sisa token"
              value={numberLabel(Math.max(stats.totalTokens - stats.usedTokens, 0))}
              dark
            />
            <Stat label="Suara terakhir" value={timeLabel(stats.lastVoteAt)} dark />
          </section>

          <div className="flex flex-col gap-2 border-t border-white/10 pt-4 text-sm text-neutral-300 sm:flex-row sm:items-center sm:justify-between">
            <p>Terakhir diperbarui: {timeLabel(stats.generatedAt)}</p>
            <p className="inline-flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${polling ? "animate-pulse bg-amber-300" : "bg-emerald-400"}`}
              />
              Auto-refresh setiap 2 detik
            </p>
          </div>
        </div>
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
          <button
            type="button"
            onClick={() => {
              setLiveMode(true);
              void requestDashboardFullscreen();
            }}
            disabled={!stats}
            className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Live Mode
          </button>
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
            <Stat label="Total suara" value={numberLabel(stats.totalVotes)} />
            <Stat label="Partisipasi" value={percentLabel(stats.participationRate)} />
            <Stat
              label="Sisa token"
              value={numberLabel(Math.max(stats.totalTokens - stats.usedTokens, 0))}
            />
          </div>

          <CandidateBars stats={stats} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  dark = false,
  compact = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border shadow-sm ${compact ? "p-4" : "p-5"} ${dark ? "border-white/10 bg-white/10" : "border-neutral-200 bg-white"}`}
    >
      <p className={`text-sm font-medium ${dark ? "text-neutral-300" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className={`mt-3 font-bold ${compact ? "text-2xl" : "text-3xl"}`}>{value}</p>
    </div>
  );
}

function CandidateBars({
  stats,
  dark = false,
  ranked = false,
}: {
  stats: DashboardStats;
  dark?: boolean;
  ranked?: boolean;
}) {
  const candidates = ranked
    ? [...stats.candidateStats].sort((first, second) => {
        if (second.voteCount !== first.voteCount) {
          return second.voteCount - first.voteCount;
        }
        return first.orderNumber - second.orderNumber;
      })
    : stats.candidateStats;

  return (
    <section
      className={`mt-6 rounded-lg border p-5 shadow-sm ${dark ? "border-white/10 bg-white/10" : "border-neutral-200 bg-white"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Hasil per kandidat</h3>
        {ranked ? (
          <span className="text-xs font-semibold text-neutral-400">Ranking live</span>
        ) : null}
      </div>
      <div className="mt-5 space-y-5">
        {candidates.map((candidate, index) => (
          <div
            key={candidate.candidateId}
            className={
              ranked && index === 0
                ? "rounded-lg border border-emerald-300/40 bg-emerald-400/10 p-4"
                : undefined
            }
          >
            <div className="flex flex-col gap-2 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                {ranked ? (
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs">
                    #{index + 1}
                  </span>
                ) : null}
                No. {candidate.orderNumber} {candidate.name}
              </span>
              <span className={dark ? "text-neutral-200" : "text-neutral-700"}>
                {numberLabel(candidate.voteCount)} suara ({percentLabel(candidate.percentage)})
              </span>
            </div>
            <div
              className={`mt-3 h-4 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-neutral-100"}`}
            >
              <div
                className={`h-full rounded-full ${ranked && index === 0 ? "bg-emerald-400" : "bg-indigo-600"}`}
                style={{ width: `${Math.min(candidate.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
