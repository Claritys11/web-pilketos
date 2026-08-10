"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { FullscreenOverlay } from "@/components/voting/FullscreenOverlay";
import { Stepper } from "@/components/voting/Stepper";
import { normalizeToken, saveVotingSession } from "@/lib/vote/client-state";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface ValidateTokenData {
  electionId: string;
  electionTitle: string;
}

export default function VoteTokenPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const tokenParam = new URLSearchParams(window.location.search).get("token");
    if (tokenParam) {
      queueMicrotask(() => setToken(normalizeToken(tokenParam)));
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedToken = normalizeToken(token);

    if (normalizedToken.length < 8) {
      setError("Token minimal 8 karakter.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/vote/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: normalizedToken }),
      });
      const result = (await response.json()) as ApiResponse<ValidateTokenData>;

      if (!result.success || !result.data) {
        setError(result.error?.message ?? "Token tidak valid.");
        return;
      }

      saveVotingSession({
        token: normalizedToken,
        electionId: result.data.electionId,
        electionTitle: result.data.electionTitle,
      });
      router.push("/vote/fullscreen");
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col overflow-hidden px-5 py-8 sm:px-8 lg:py-12">
      <FullscreenOverlay
        title="Masuk mode layar penuh"
        description="Voting hanya bisa dilakukan dalam layar penuh. Tetap berada di halaman ini sampai suara selesai dikirim."
        buttonLabel="Masuk Layar Penuh"
      />
      <Stepper currentStep={1} />

      <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_420px]">
        <div className="order-2 lg:order-1">
          <div className="flex items-center gap-3">
            <img
              src="/e-pilketos-copy/logo-osis.png"
              alt="Logo OSIS"
              className="h-14 w-14 object-contain"
            />
            <img
              src="/e-pilketos-copy/logo-mpk.png"
              alt="Logo MPK"
              className="h-14 w-14 object-contain"
            />
          </div>
          <p className="mt-8 text-sm font-semibold uppercase text-[var(--color-primary-700)]">
            E-Pilketos
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-neutral-950 sm:text-6xl">
            Pemungutan suara ketua OSIS
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-600">
            Gunakan token resmi dari email panitia. Token hanya bisa dipakai satu kali dan proses
            voting harus tetap berada dalam mode layar penuh.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Token unik", "Layar penuh", "Satu suara"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-red-100 bg-white/80 px-4 py-3 text-sm font-semibold text-[var(--color-primary-700)] shadow-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 w-full rounded-lg border border-red-100 bg-white p-6 shadow-lg sm:p-8 lg:order-2">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase text-[var(--color-primary-700)]">
              Masuk voting
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-neutral-950">
              Masukkan token
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="token" className="text-sm font-semibold text-neutral-800">
                Token
              </label>
              <input
                id="token"
                value={token}
                onChange={(event) => {
                  setToken(normalizeToken(event.target.value));
                  setError(null);
                }}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="CONTOH12345"
                className={`mt-2 h-14 w-full rounded-lg border px-4 font-mono text-lg font-semibold text-neutral-950 outline-none transition focus:ring-2 focus:ring-[var(--color-vote-primary)] ${
                  error ? "border-red-500 bg-red-50" : "border-red-100 bg-neutral-50"
                }`}
              />
              {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-full rounded-lg bg-[var(--color-vote-primary)] px-6 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? "Memvalidasi..." : "Lanjut"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
