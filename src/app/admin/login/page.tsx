import { Suspense } from "react";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#fff6f6_0%,#fff_45%,#fee2e2_100%)] px-5 py-10">
      <Suspense fallback={<LoginFallback />}>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}

function LoginFallback() {
  return (
    <section className="w-full max-w-md rounded-lg border border-red-100 bg-white p-8 shadow-xl shadow-red-950/10">
      <div className="h-5 w-24 rounded bg-neutral-100" />
      <div className="mt-5 h-9 w-52 rounded bg-neutral-100" />
      <div className="mt-3 h-5 w-full rounded bg-neutral-100" />
      <div className="mt-8 h-12 w-full rounded bg-neutral-100" />
      <div className="mt-5 h-12 w-full rounded bg-neutral-100" />
      <div className="mt-6 h-12 w-full rounded bg-neutral-100" />
    </section>
  );
}
