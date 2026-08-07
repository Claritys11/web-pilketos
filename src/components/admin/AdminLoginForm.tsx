"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { Alert } from "@/components/common/Alert";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Username atau password salah.");
      return;
    }

    const redirectTo = searchParams.get("redirect") || "/admin/dashboard";
    router.replace(redirectTo.startsWith("/admin") ? redirectTo : "/admin/dashboard");
    router.refresh();
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-red-100 bg-white p-6 shadow-xl shadow-red-950/10 sm:p-8">
      <div>
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-red-50 text-[var(--color-primary-700)]">
          <ShieldCheck aria-hidden="true" size={24} />
        </div>
        <p className="mt-5 text-sm font-bold uppercase tracking-wide text-[var(--color-primary-700)]">
          Pilketos
        </p>
        <h1 className="mt-3 text-3xl font-bold text-neutral-950">Masuk Admin</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Gunakan akun panitia resmi. Semua aktivitas penting tercatat di audit log.
        </p>
      </div>

      {error ? (
        <div className="mt-6">
          <Alert tone="danger" title="Login gagal">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="username" className="text-sm font-semibold text-neutral-800">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            disabled={isSubmitting}
            className="mt-2 h-12 w-full rounded-lg border border-red-100 bg-white px-4 text-neutral-950 outline-none transition focus:ring-2 focus:ring-[var(--color-primary-600)] disabled:bg-neutral-100"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-semibold text-neutral-800">
            Password
          </label>
          <div className="mt-2 flex rounded-lg border border-red-100 bg-white focus-within:ring-2 focus-within:ring-[var(--color-primary-600)]">
            <input
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={isSubmitting}
              className="h-12 min-w-0 flex-1 rounded-l-lg bg-transparent px-4 text-neutral-950 outline-none disabled:bg-neutral-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              disabled={isSubmitting}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              className="grid h-12 w-14 shrink-0 place-items-center rounded-r-lg border-l border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" size={18} />
              ) : (
                <Eye aria-hidden="true" size={18} />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-lg bg-[var(--color-vote-primary)] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] focus:ring-offset-2 disabled:opacity-60"
        >
          {isSubmitting ? "Memverifikasi..." : "Masuk"}
        </button>
      </form>
    </section>
  );
}
