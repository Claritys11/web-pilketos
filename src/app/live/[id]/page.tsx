"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { RefreshCw, AlertCircle, User } from "lucide-react";
import { LiveCounterAnimation } from "@/components/live/LiveCounterAnimation";

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

// ─── Pulse dot animation (inline style for portability) ──────────────────────
const pulseDotStyle = `
  @keyframes pulse-dot {
    0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(192,0,24,0.7); }
    70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(192,0,24,0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(192,0,24,0); }
  }
  .live-dot { animation: pulse-dot 2s infinite; }

  @keyframes marquee {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .marquee-track { animation: marquee 28s linear infinite; }
`;

// ─── Glass card helper ────────────────────────────────────────────────────────
const glassStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderTop: "1px solid rgba(255,255,255,0.45)",
  borderLeft: "1px solid rgba(255,255,255,0.45)",
};

// ─── Candidate photo avatar ───────────────────────────────────────────────────
function CandidateAvatar({
  photoUrl,
  name,
}: {
  photoUrl?: string | null | undefined;
  name: string;
}) {
  return (
    <div className="w-[88px] h-[88px] rounded-full overflow-hidden border-4 border-white shadow-md bg-[#e4e2e1] flex-shrink-0">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={88}
          height={88}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-10 h-10 text-[#926f6b]" />
        </div>
      )}
    </div>
  );
}

// ─── VS vertical rail that shifts the badge based on cand1 lead ───────────────
function VSRail({ percent1 }: { percent1: number }) {
  const [pos, setPos] = useState(percent1);
  const prev = useRef(percent1);

  useEffect(() => {
    const t = setTimeout(() => {
      prev.current = percent1;
      setPos(percent1);
    }, 100);
    return () => clearTimeout(t);
  }, [percent1]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* The rail track */}
      <div className="absolute w-2.5 h-full rounded-full bg-[#e4e2e1] overflow-hidden">
        {/* Red fill from top = cand1 lead */}
        <div
          className="absolute top-0 left-0 w-full rounded-t-full bg-[#c00018]"
          style={{ height: `${pos}%`, transition: "height 1.8s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </div>
      {/* VS badge gliding along rail */}
      <div
        className="absolute z-20 flex items-center justify-center"
        style={{
          top: `${pos}%`,
          transform: "translateY(-50%)",
          transition: "top 1.8s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#c00018] to-[#930000] flex items-center justify-center shadow-lg border-2 border-white text-white font-black text-base italic tracking-tight select-none">
          VS
        </div>
      </div>
    </div>
  );
}

// ─── Stat info card ───────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={glassStyle}
      className="rounded-xl p-4 flex items-center gap-4 shadow-sm border border-white/40"
    >
      <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-[#c00018]/10 text-[#c00018] flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-widest text-[#926f6b] mb-0.5">
          {label}
        </span>
        <span className="block text-[15px] font-bold text-[#1b1c1c] leading-snug">{value}</span>
        {sub && <span className="block text-xs text-[#926f6b] mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Multi-candidate grid (more than 2 candidates) ───────────────────────────
function MultiCandidateGrid({
  candidates,
  totalVotes,
}: {
  candidates: Candidate[];
  totalVotes: number;
}) {
  const maxVotes = Math.max(...candidates.map((c) => c.voteCount), 1);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {candidates.map((cand) => {
        const isLeader = cand.voteCount === maxVotes && totalVotes > 0;
        return (
          <div
            key={cand.id}
            style={glassStyle}
            className={`relative rounded-2xl p-5 flex flex-col gap-3 border ${isLeader ? "border-[rgba(231,35,42,0.25)] shadow-[0_0_32px_-8px_rgba(231,35,42,0.15)]" : "border-white/40 shadow-sm"}`}
          >
            {isLeader && (
              <div className="absolute top-0 right-0 bg-[#e7232a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl rounded-tr-2xl z-10">
                UNGGUL
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow bg-[#e4e2e1] flex-shrink-0">
                {cand.photoUrl ? (
                  <Image
                    src={cand.photoUrl}
                    alt={cand.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-7 h-7 text-[#926f6b]" />
                  </div>
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#926f6b]">
                  Kandidat {cand.orderNumber}
                </span>
                <h2 className="text-sm font-bold text-[#1b1c1c] leading-tight">{cand.name}</h2>
                <span className="text-xs text-[#926f6b]">{cand.className}</span>
              </div>
            </div>
            <div className="mt-auto">
              <span className="text-3xl font-black tabular-nums text-[#c00018]">
                <LiveCounterAnimation
                  value={cand.percentage}
                  durationMs={1200}
                  decimals={1}
                  suffix="%"
                />
              </span>
              <div className="mt-2 h-1.5 rounded-full bg-[#f0eded] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#c00018] transition-all duration-[1800ms] ease-out"
                  style={{ width: `${cand.percentage}%` }}
                />
              </div>
              <span className="block mt-1 text-xs text-[#5d3f3c]">
                {cand.voteCount.toLocaleString("id-ID")} suara
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LiveCountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchLive() {
      try {
        const res = await fetch(`/api/live/${id}`);
        if (!res.ok) {
          throw new Error("Gagal mengambil data live count.");
        }
        const json = await res.json();
        if (active) {
          if (json.success) {
            setData(json.data);
            setError(null);
          } else {
            setError(json.error?.message || "Terjadi kesalahan.");
          }
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
    void fetchLive();
    const iv = setInterval(() => void fetchLive(), 5000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div
          style={glassStyle}
          className="flex flex-col items-center gap-4 rounded-3xl p-10 border border-white/40 shadow-md"
        >
          <RefreshCw className="h-9 w-9 animate-spin text-[#c00018]" />
          <p className="text-sm font-semibold tracking-wide text-[#5d3f3c]">
            Menyiapkan Live Count…
          </p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div
          style={glassStyle}
          className="flex max-w-md flex-col items-center text-center rounded-3xl p-10 border border-white/40 shadow-md"
        >
          <AlertCircle className="h-12 w-12 text-[#c00018] mb-4" />
          <h2 className="text-2xl font-bold text-[#1b1c1c] mb-2">Gagal Memuat Live Mode</h2>
          <p className="text-sm text-[#5d3f3c] mb-6">{error ?? "Data tidak ditemukan."}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[#c00018] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#930000] transition shadow-lg"
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
  const cand1IsLeader = isTwoCandidates && !!cand1 && !!cand2 && cand1.voteCount > cand2.voteCount;
  const cand2IsLeader = isTwoCandidates && !!cand1 && !!cand2 && cand2.voteCount > cand1.voteCount;

  const syncTime = new Date(generatedAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Live ticker items
  const tickerItems = candidates.flatMap((c) => [
    `${c.name}: ${c.voteCount.toLocaleString("id-ID")} suara (${c.percentage.toFixed(1)}%)`,
  ]);
  const tickerText = tickerItems.join("    •    ");

  return (
    <>
      <style>{pulseDotStyle}</style>

      {/* ── Outer canvas: 16:9 constrained, flex column ────────────────── */}
      <main className="relative z-10 h-full flex flex-col gap-5 px-8 pt-7 pb-0 max-w-[1280px] mx-auto w-full">
        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center gap-2 flex-shrink-0">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#c00018]/20 bg-[#c00018]/10 px-4 py-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#c00018] live-dot" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#c00018]">
              Live Update
            </span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-[#1b1c1c] leading-tight">
            {election.title}
          </h1>
          {election.description && (
            <p className="text-sm text-[#5d3f3c] max-w-2xl leading-relaxed">
              {election.description}
            </p>
          )}
        </header>

        {/* ── MAIN DASHBOARD ────────────────────────────────────────────── */}
        <section className="flex-1 min-h-0">
          {isTwoCandidates && cand1 && cand2 ? (
            /* 1v1 head-to-head with VS vertical rail */
            <div className="grid grid-cols-[1fr_80px_1fr] gap-4 h-full items-stretch">
              {/* Candidate 1 card */}
              <div
                style={{
                  ...glassStyle,
                  ...(cand1IsLeader
                    ? {
                        boxShadow: "0 0 40px -10px rgba(231,35,42,0.18)",
                        border: "1px solid rgba(231,35,42,0.22)",
                      }
                    : { border: "1px solid rgba(255,255,255,0.4)" }),
                }}
                className="relative rounded-2xl p-6 flex flex-col overflow-hidden shadow-sm"
              >
                {cand1IsLeader && (
                  <div className="absolute top-0 right-0 bg-[#e7232a] text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl rounded-tr-2xl z-10 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    UNGGUL
                  </div>
                )}
                <div className="flex items-start gap-5 mb-4">
                  <CandidateAvatar photoUrl={cand1.photoUrl} name={cand1.name} />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#926f6b]">
                      Kandidat {cand1.orderNumber}
                    </span>
                    <h2 className="text-xl font-bold text-[#1b1c1c] leading-tight mt-0.5">
                      {cand1.name}
                    </h2>
                    <span className="text-sm font-medium text-[#c00018]">{cand1.className}</span>
                  </div>
                </div>
                <div className="mt-auto flex flex-col items-start">
                  <span
                    className="font-black tracking-tighter leading-none text-[#c00018]"
                    style={{ fontSize: "clamp(2.8rem,5.5vw,4rem)" }}
                  >
                    <LiveCounterAnimation
                      value={cand1.percentage}
                      durationMs={1400}
                      decimals={1}
                      suffix="%"
                    />
                  </span>
                  <span className="mt-1.5 text-sm text-[#5d3f3c] flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="w-4 h-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {cand1.voteCount.toLocaleString("id-ID")} Suara
                  </span>
                </div>
                {cand1IsLeader && (
                  <div
                    className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none"
                    style={{ background: "rgba(192,0,24,0.06)" }}
                  />
                )}
              </div>

              {/* Central VS rail */}
              <div className="flex items-stretch justify-center py-4">
                <VSRail percent1={cand1.percentage} />
              </div>

              {/* Candidate 2 card */}
              <div
                style={{
                  ...glassStyle,
                  ...(cand2IsLeader
                    ? {
                        boxShadow: "0 0 40px -10px rgba(231,35,42,0.18)",
                        border: "1px solid rgba(231,35,42,0.22)",
                      }
                    : { border: "1px solid rgba(255,255,255,0.4)" }),
                }}
                className="relative rounded-2xl p-6 flex flex-col overflow-hidden shadow-sm"
              >
                {cand2IsLeader && (
                  <div className="absolute top-0 left-0 bg-[#e7232a] text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-br-xl rounded-tl-2xl z-10 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    UNGGUL
                  </div>
                )}
                <div className="flex items-start gap-5 mb-4 flex-row-reverse text-right">
                  <CandidateAvatar photoUrl={cand2.photoUrl} name={cand2.name} />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#926f6b]">
                      Kandidat {cand2.orderNumber}
                    </span>
                    <h2 className="text-xl font-bold text-[#1b1c1c] leading-tight mt-0.5">
                      {cand2.name}
                    </h2>
                    <span className="text-sm font-medium text-[#5d3f3c]">{cand2.className}</span>
                  </div>
                </div>
                <div className="mt-auto flex flex-col items-end">
                  <span
                    className="font-black tracking-tighter leading-none opacity-80 text-[#1b1c1c]"
                    style={{ fontSize: "clamp(2.8rem,5.5vw,4rem)" }}
                  >
                    <LiveCounterAnimation
                      value={cand2.percentage}
                      durationMs={1400}
                      decimals={1}
                      suffix="%"
                    />
                  </span>
                  <span className="mt-1.5 text-sm text-[#5d3f3c] flex items-center gap-1.5">
                    {cand2.voteCount.toLocaleString("id-ID")} Suara
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="w-4 h-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <MultiCandidateGrid candidates={candidates} totalVotes={totalVotes} />
          )}
        </section>

        {/* ── STATS CARDS ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 flex-shrink-0 pb-1">
          <StatCard
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M12 12a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
            }
            label="Total Suara Masuk"
            value={totalVotes.toLocaleString("id-ID")}
            sub="dari DPT yang terdaftar"
          />
          <StatCard
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
            label="Data Per Kandidat"
            value={candidates
              .map((c) => `${c.name.split(" ")[0]}: ${c.voteCount.toLocaleString("id-ID")}`)
              .join("  ·  ")}
          />
          <StatCard
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            label="Terakhir Diperbarui"
            value={syncTime}
            sub="Auto-refresh setiap 5 detik"
          />
        </div>
      </main>

      {/* ── LIVE TICKER FOOTER ────────────────────────────────────────── */}
      <footer className="flex-shrink-0 w-full flex h-11 border-t border-[#e7bdb8] bg-white overflow-hidden relative z-20">
        {/* "LATEST" badge */}
        <div className="bg-[#c00018] flex items-center justify-center px-5 text-white text-[11px] font-black uppercase tracking-widest whitespace-nowrap shadow-[4px_0_12px_rgba(0,0,0,0.08)] z-10 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-white mr-2 live-dot" />
          TERKINI
        </div>
        {/* Scrolling ticker */}
        <div className="flex items-center flex-grow overflow-hidden bg-white relative">
          <div className="marquee-track inline-flex gap-16 px-8 text-sm font-medium text-[#1b1c1c] whitespace-nowrap">
            {/* Duplicate for seamless loop */}
            <span>{tickerText}</span>
            <span className="text-[#926f6b]">•</span>
            <span>{tickerText}</span>
            <span className="text-[#926f6b]">•</span>
          </div>
        </div>
      </footer>
    </>
  );
}
