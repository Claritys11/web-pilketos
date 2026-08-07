"use client";

/* eslint-disable @next/next/no-img-element */

import { signOut } from "next-auth/react";
import { BarChart3, ClipboardList, FileClock, LogOut, Menu, Settings, Vote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, roleTone } from "@/components/common/Badge";
import type { AdminSessionUser } from "@/lib/admin/types";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}> = [
  { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/elections", label: "Elections", icon: Vote },
  { href: "/admin/audit", label: "Audit Log", icon: FileClock },
  { href: "/admin/settings", label: "Settings", icon: Settings, superAdminOnly: true },
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
    <aside className="flex h-full w-72 flex-col border-r border-red-100 bg-white">
      <div className="border-b border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
        <div className="flex items-center gap-3">
          <img
            src="/e-pilketos-copy/logo-mpk.png"
            alt="Logo MPK"
            className="h-12 w-12 object-contain"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[var(--color-primary-700)]">
              E-Pilketos
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-500">Ruang kendali pemilihan</p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-red-100 bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase text-neutral-500">Operator aktif</p>
          <p className="mt-1 truncate text-sm font-bold text-neutral-950">{user.username}</p>
        </div>
      </div>

      <nav aria-label="Navigasi admin" className="flex-1 space-y-1 p-3">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center gap-3 rounded-lg border-l-4 px-3 text-sm font-semibold transition ${
                active
                  ? "border-[var(--color-primary-600)] bg-red-50 text-[var(--color-primary-700)]"
                  : "border-transparent text-neutral-600 hover:bg-red-50 hover:text-neutral-950"
              }`}
            >
              <Icon aria-hidden="true" size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-red-100 p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-semibold text-neutral-950">{user.username}</p>
          <div className="mt-2">
            <Badge tone={roleTone(user.role)}>{user.role}</Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/admin/login" })}
          className="h-10 w-full rounded-lg border border-red-100 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <LogOut aria-hidden="true" size={16} />
            Logout
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff6f6_0%,#fff_42%,#fff6f6_100%)] text-neutral-950">
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

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-red-100 bg-white/90 px-4 shadow-sm shadow-red-950/5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Buka navigasi"
              className="grid h-11 w-11 place-items-center rounded-lg border border-red-100 text-neutral-700 lg:hidden"
            >
              <Menu aria-hidden="true" size={20} />
            </button>
            <div>
              <p className="text-xs font-medium text-neutral-500">{breadcrumbs(pathname)}</p>
              <h1 className="flex items-center gap-2 text-lg font-semibold text-neutral-950">
                <ClipboardList
                  aria-hidden="true"
                  size={18}
                  className="text-[var(--color-primary-700)]"
                />
                {pageTitle(pathname)}
              </h1>
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
