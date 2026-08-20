"use client";

import { use, useEffect, useState } from "react";
import { LiveCandidateCard } from "@/components/live/LiveCandidateCard";
import { LiveCounterAnimation } from "@/components/live/LiveCounterAnimation";
import { LiveProgressBar } from "@/components/live/LiveProgressBar";
import { AlertCircle, RefreshCw, Vote } from "lucide-react";

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
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-sm font-medium">Memuat Live Count...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 p-6">
        <div className="flex max-w-md flex-col items-center text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Gagal Memuat Live Mode</h2>
          <p className="text-sm text-slate-400 mb-6">{error || "Data tidak ditemukan."}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const { election, candidates, totalVotes } = data;
  const isTwoCandidates = candidates.length === 2;
  const cand1 = candidates[0];
  const cand2 = candidates[1];

  return (
    <main className="flex min-h-screen flex-col justify-between p-6 sm:p-12 lg:px-24">
      {/* Header */}
      <header className="flex flex-col items-center text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          LIVE COUNTING
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          {election.title}
        </h1>
        {election.description && (
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl">
            {election.description}
          </p>
        )}
      </header>

      {/* Main Content Area */}
      <section className="my-auto py-8 w-full max-w-6xl mx-auto">
        {isTwoCandidates && cand1 && cand2 ? (
          /* 1v1 Head-to-Head Mode (Matching Reference UI) */
          <div className="flex flex-col gap-10">
            {/* Top Cards & Counter Display */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Candidate 1 */}
              <div className="lg:col-span-4 flex justify-center lg:justify-start">
                <LiveCandidateCard
                  orderNumber={cand1.orderNumber}
                  name={cand1.name}
                  className={cand1.className}
                  photoUrl={cand1.photoUrl}
                  align="left"
                />
              </div>

              {/* Middle Section: Scores & VS */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center gap-4 text-center">
                <div className="flex items-center justify-center gap-6 sm:gap-10">
                  {/* Cand 1 Percentage */}
                  <div className="flex flex-col items-center">
                    <span className="text-3xl sm:text-5xl font-black text-red-400">
                      <LiveCounterAnimation value={cand1.percentage} />
                    </span>
                    <span className="text-xs font-medium text-slate-400 mt-1">
                      {cand1.voteCount} suara
                    </span>
                  </div>

                  {/* VS Divider */}
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-red-500 font-extrabold text-lg sm:text-xl shadow-lg">
                    VS
                  </div>

                  {/* Cand 2 Percentage */}
                  <div className="flex flex-col items-center">
                    <span className="text-3xl sm:text-5xl font-black text-indigo-400">
                      <LiveCounterAnimation value={cand2.percentage} />
                    </span>
                    <span className="text-xs font-medium text-slate-400 mt-1">
                      {cand2.voteCount} suara
                    </span>
                  </div>
                </div>
              </div>

              {/* Candidate 2 */}
              <div className="lg:col-span-4 flex justify-center lg:justify-end">
                <LiveCandidateCard
                  orderNumber={cand2.orderNumber}
                  name={cand2.name}
                  className={cand2.className}
                  photoUrl={cand2.photoUrl}
                  align="right"
                />
              </div>
            </div>

            {/* Central Dual Progress Bar */}
            <div className="w-full max-w-4xl mx-auto bg-slate-900/90 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl">
              <LiveProgressBar
                percent1={cand1.percentage}
                name1={cand1.name}
                name2={cand2.name}
              />
            </div>
          </div>
        ) : (
          /* Multi-candidate (or 1 candidate) fallback grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="flex flex-col p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <LiveCandidateCard
                    orderNumber={cand.orderNumber}
                    name={cand.name}
                    className={cand.className}
                    photoUrl={cand.photoUrl}
                  />
                </div>
                <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-end">
                  <div>
                    <span className="text-xs text-slate-400">Jumlah Suara</span>
                    <p className="text-lg font-bold text-white">{cand.voteCount}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-red-400">
                      <LiveCounterAnimation value={cand.percentage} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Info Bar */}
      <footer className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-red-500" />
          <span>
            Total Suara Masuk: <strong className="text-white">{totalVotes}</strong>
          </span>
        </div>
        <div>Auto-refresh setiap 5 detik</div>
      </footer>
    </main>
  );
}
