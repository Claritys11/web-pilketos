"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Badge, electionStatusTone } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { SkeletonCard } from "@/components/common/Skeleton";
import { MAX_TOKEN_BATCH_SIZE } from "@/config/tokens";
import { adminFetch } from "@/lib/admin/api";
import type { AdminSessionUser, DashboardStats, ElectionDetail } from "@/lib/admin/types";

interface GenerateResult {
  electionId: string;
  generatedCount: number;
  tokens: string[];
}

export function TokensClient({ electionId, user }: { electionId: string; user: AdminSessionUser }) {
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [count, setCount] = useState(50);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canGenerate = user.role !== "VIEWER" && election?.status === "SETUP";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const electionData = await adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}`);
      setElection(electionData);
      setStats(
        await adminFetch<DashboardStats>(`/api/admin/dashboard/stats?electionId=${electionId}`),
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat token.");
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

  async function generateTokens(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    try {
      setError(null);
      const result = await adminFetch<GenerateResult>("/api/admin/tokens/generate", {
        method: "POST",
        body: JSON.stringify({ electionId, count }),
      });
      setGenerated(result);
      try {
        downloadPlaintextCsv(result.tokens);
      } catch {
        setError(
          "Token berhasil dibuat, tetapi download CSV otomatis gagal. Gunakan tombol Download CSV.",
        );
      }
      await load();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal generate token.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadPlaintextCsv(tokens: string[]) {
    const csv = [
      "token_number,token",
      ...tokens.map((token, index) => `${index + 1},${token}`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "token-plaintext-pilketos.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <SkeletonCard />;
  }

  const totalTokens = stats?.totalTokens ?? election?._count?.tokens ?? 0;
  const usedTokens = stats?.usedTokens ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/elections/${electionId}`}
        className="text-sm font-semibold text-indigo-700 hover:underline"
      >
        Kembali ke detail election
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-700">{election?.title ?? "Election"}</p>
          <h2 className="mt-1 text-2xl font-bold text-neutral-950">Token Voting</h2>
          {election ? (
            <div className="mt-2">
              <Badge tone={electionStatusTone(election.status)}>{election.status}</Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setGeneratorOpen(true)}
            disabled={!canGenerate}
            className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Generate Token
          </button>
          <a
            href={`/api/admin/tokens/export?electionId=${electionId}`}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Export Metadata
          </a>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Total token" value={String(totalTokens)} />
        <Stat label="Digunakan" value={String(usedTokens)} />
        <Stat label="Sisa" value={String(Math.max(totalTokens - usedTokens, 0))} />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-950">Token Batch</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Token plaintext hanya tampil satu kali setelah dibuat. Generate token hanya tersedia saat
          election masih SETUP.
        </p>
      </section>

      {generatorOpen ? (
        <Modal title="Generate Token Batch" onClose={() => setGeneratorOpen(false)}>
          <form onSubmit={generateTokens} className="space-y-5">
            <label className="block flex-1">
              <span className="text-sm font-semibold text-neutral-800">Jumlah token</span>
              <input
                type="number"
                min={1}
                max={MAX_TOKEN_BATCH_SIZE}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3"
              />
              <span className="mt-2 block text-xs font-medium text-neutral-500">
                Maksimal {MAX_TOKEN_BATCH_SIZE} token per batch.
              </span>
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGeneratorOpen(false)}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canGenerate || generating}
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? "Generate..." : "Generate"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {generated ? (
        <Modal
          title={`${generated.generatedCount} Token Berhasil Dibuat`}
          onClose={() => setGenerated(null)}
        >
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Simpan token ini sekarang. Setelah modal ditutup, plaintext token tidak dapat diakses
            lagi.
          </div>
          <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm">
            {generated.tokens.map((token) => (
              <p key={token}>{token}</p>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => downloadPlaintextCsv(generated.tokens)}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => setGenerated(null)}
              className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white"
            >
              Tutup
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-neutral-950">{value}</p>
    </div>
  );
}
