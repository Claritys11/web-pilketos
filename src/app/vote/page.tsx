"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:py-12">
      <Stepper currentStep={1} />

      <section className="grid flex-1 place-items-center py-10">
        <div className="w-full max-w-xl rounded-lg border border-neutral-200 bg-white p-6 shadow-md sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase text-emerald-700">Pilketos E-Voting</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-neutral-950 sm:text-5xl">
              Masukkan token voting
            </h1>
            <p className="mt-4 text-base leading-7 text-neutral-600">
              Gunakan token dari panitia. Token hanya bisa dipakai satu kali dan pilihan tidak akan
              ditampilkan kembali setelah dikirim.
            </p>
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
                  error ? "border-red-500 bg-red-50" : "border-neutral-200 bg-neutral-50"
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
