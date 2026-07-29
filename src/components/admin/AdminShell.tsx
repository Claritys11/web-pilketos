"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, roleTone } from "@/components/common/Badge";
import type { AdminSessionUser } from "@/lib/admin/types";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  superAdminOnly?: boolean;
}> = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/elections", label: "Elections" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/settings", label: "Settings", superAdminOnly: true },
];

function pageTitle(pathname: string) {
  if (pathname.startsWith("/admin/elections")) {
    return "Elections";
  }
  if (pathname.startsWith("/admin/audit")) {
    return "Audit Log";
  }
  if (pathname.startsWith("/admin/settings")) {
    return "Settings";
  }
  return "Dashboard";
}

function breadcrumbs(pathname: string) {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => (part.length > 18 ? `${part.slice(0, 8)}...` : part));
  return parts.length ? parts.join(" / ") : "admin";
}

export function AdminShell({
  user,
  children,
}: {
  user: AdminSessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => !item.superAdminOnly || user.role === "SUPER_ADMIN"),
    [user.role],
  );

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 p-5">
        <p className="text-sm font-bold uppercase text-indigo-700">Pilketos</p>
        <p className="mt-1 text-xs font-medium text-neutral-500">Admin Panel</p>
      </div>

      <nav aria-label="Navigasi admin" className="flex-1 space-y-1 p-3">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center rounded-lg border-l-4 px-3 text-sm font-semibold transition ${
                active
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-semibold text-neutral-950">{user.username}</p>
          <div className="mt-2">
            <Badge tone={roleTone(user.role)}>{user.role}</Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/admin/login" })}
          className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">{sidebar}</div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Buka navigasi"
              className="grid h-11 w-11 place-items-center rounded-lg border border-neutral-200 text-xl text-neutral-700 lg:hidden"
            >
              =
            </button>
            <div>
              <p className="text-xs font-medium text-neutral-500">{breadcrumbs(pathname)}</p>
              <h1 className="text-lg font-semibold text-neutral-950">{pageTitle(pathname)}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-sm font-medium text-neutral-600">{user.username}</span>
            <Badge tone={roleTone(user.role)}>{user.role}</Badge>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
