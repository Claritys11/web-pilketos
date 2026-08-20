"use client";

import { use, useEffect, useState } from "react";
import { LiveCandidateCard } from "@/components/live/LiveCandidateCard";
import { LiveCounterAnimation } from "@/components/live/LiveCounterAnimation";
import { LiveProgressBar } from "@/components/live/LiveProgressBar";
import { AlertCircle, RefreshCw, Vote, ShieldCheck, Clock } from "lucide-react";

interface Candidate {
  id: string;
  orderNumber: number;
  name: string;
  className: string;
  photoUrl?: string | null;
  voteCount: number;
  percentage: number;
}

interface LiveData {
  election: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    mode: string;
    openedAt?: string | null;
  };
  totalVotes: number;
  candidates: Candidate[];
  refreshIntervalMs: number;
  generatedAt: string;
}

export default function LiveCountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchLiveCount() {
      try {
        const res = await fetch(`/api/live/${id}`);
        if (!res.ok) {
          throw new Error("Gagal mengambil data Live Count");
        }
        const json = await res.json();
        if (json.success && active) {
          setData(json.data);
          setError(null);
        } else if (!json.success && active) {
          setError(json.error?.message || "Terjadi kesalahan.");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Gagal memuat data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchLiveCount();

    const intervalId = setInterval(() => {
      void fetchLiveCount();
    }, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0B0F17] text-slate-400">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-slate-900/60 p-8 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <RefreshCw className="h-10 w-10 animate-spin text-red-500" />
          <p className="text-sm font-semibold tracking-wide text-slate-300">
            Menyiapkan Display Live Count...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0F17] p-6">
        <div className="flex max-w-md flex-col items-center text-center rounded-3xl bg-slate-900/80 p-8 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Gagal Memuat Live Mode</h2>
          <p className="text-sm text-slate-400 mb-6">{error || "Data tidak ditemukan."}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-600/30"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const { election, candidates, totalVotes, generatedAt } = data;
  const isTwoCandidates = candidates.length === 2;
  const cand1 = candidates[0];
  const cand2 = candidates[1];

  const cand1IsLeader = isTwoCandidates && cand1 && cand2 && cand1.voteCount > cand2.voteCount;
  const cand2IsLeader = isTwoCandidates && cand1 && cand2 && cand2.voteCount > cand1.voteCount;

  const formattedSyncTime = new Date(generatedAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <main className="flex min-h-screen flex-col justify-between p-4 sm:p-8 lg:p-12 max-w-[1600px] mx-auto">
      {/* Broadcast Header */}
      <header className="flex flex-col items-center text-center space-y-4 pt-2">
        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-3 rounded-full border border-red-500/30 bg-gradient-to-r from-red-950/40 via-red-900/30 to-red-950/40 px-4 py-1.5 backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]" />
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-red-400 font-mono">
            E-PILKETOS LIVE COUNTING
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-xs font-semibold text-slate-400">REAL-TIME BROADCAST</span>
        </div>

        {/* Election Main Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-300">
          {election.title}
        </h1>

        {election.description && (
          <p className="text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
            {election.description}
          </p>
        )}
      </header>

      {/* Main Showcase Center Arena */}
      <section className="my-auto py-6 sm:py-10 w-full">
        {isTwoCandidates && cand1 && cand2 ? (
          /* 1v1 Broadcast Head-to-Head Arena */
          <div className="flex flex-col gap-10">
            {/* Candidates & Middle VS Scoreboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Showcase (Candidate 1 - Red) */}
              <div className="lg:col-span-4 flex justify-center lg:justify-start">
                <LiveCandidateCard
                  orderNumber={cand1.orderNumber}
                  name={cand1.name}
                  className={cand1.className}
                  photoUrl={cand1.photoUrl}
                  align="left"
                  isLeader={cand1IsLeader}
                />
              </div>

              {/* Center Scoreboards & VS Badge */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center gap-6 text-center">
                <div className="flex items-center justify-center gap-6 sm:gap-10">
                  {/* Candidate 1 Score Box */}
                  <div className="flex flex-col items-center">
                    <span className="text-4xl sm:text-6xl lg:text-7xl font-black text-red-400 font-mono tracking-tight drop-shadow-[0_0_25px_rgba(248,113,113,0.3)]">
                      <LiveCounterAnimation value={cand1.percentage} />
                    </span>
                    <span className="mt-2 inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-300 font-mono">
                      {cand1.voteCount} Suara
                    </span>
                  </div>

                  {/* VS Badge Ring */}
                  <div className="relative flex shrink-0 h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700/80 text-white font-black text-xl sm:text-2xl shadow-2xl">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-sky-400 font-extrabold">
                      VS
                    </span>
                    <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse" />
                  </div>

                  {/* Candidate 2 Score Box */}
                  <div className="flex flex-col items-center">
                    <span className="text-4xl sm:text-6xl lg:text-7xl font-black text-sky-400 font-mono tracking-tight drop-shadow-[0_0_25px_rgba(56,189,248,0.3)]">
                      <LiveCounterAnimation value={cand2.percentage} />
                    </span>
                    <span className="mt-2 inline-block px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-bold text-sky-300 font-mono">
                      {cand2.voteCount} Suara
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Showcase (Candidate 2 - Sky/Blue) */}
              <div className="lg:col-span-4 flex justify-center lg:justify-end">
                <LiveCandidateCard
                  orderNumber={cand2.orderNumber}
                  name={cand2.name}
                  className={cand2.className}
                  photoUrl={cand2.photoUrl}
                  align="right"
                  isLeader={cand2IsLeader}
                />
              </div>
            </div>

            {/* Central Dual Progress Bar Card */}
            <div className="w-full max-w-5xl mx-auto bg-slate-900/60 p-6 sm:p-8 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-2xl">
              <LiveProgressBar
                percent1={cand1.percentage}
                name1={cand1.name}
                name2={cand2.name}
                voteCount1={cand1.voteCount}
                voteCount2={cand2.voteCount}
              />
            </div>
          </div>
        ) : (
          /* Multi-Candidate Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl shadow-xl hover:border-slate-700 transition"
              >
                <div className="mb-4">
                  <LiveCandidateCard
                    orderNumber={cand.orderNumber}
                    name={cand.name}
                    className={cand.className}
                    photoUrl={cand.photoUrl}
                  />
                </div>
                <div className="pt-4 border-t border-slate-800/80 flex items-end justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-400">Total Suara</span>
                    <p className="text-xl font-bold text-white font-mono">{cand.voteCount}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-red-400 font-mono">
                      <LiveCounterAnimation value={cand.percentage} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Broadcast Footer Info Ticker */}
      <footer className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 px-6 text-xs text-slate-400 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Vote className="h-4 w-4 text-red-500" />
            <span>
              Total Suara Masuk: <strong className="text-white font-mono text-sm ml-1">{totalVotes}</strong>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Sistem Pemilihan Resmi</span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Update: {formattedSyncTime}</span>
          </div>
          <span>•</span>
          <span className="text-slate-400">Auto-refresh 5s</span>
        </div>
      </footer>
    </main>
  );
}
