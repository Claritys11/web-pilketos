"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Badge, roleTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SkeletonTable } from "@/components/common/Skeleton";
import { adminFetch, buildQuery } from "@/lib/admin/api";
import type { AdminAccount, AdminRole, AdminSessionUser, Paginated } from "@/lib/admin/types";

interface AdminFormState {
  id?: string;
  username: string;
  email: string;
  password: string;
  role: AdminRole;
  isActive: boolean;
}

const ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "VIEWER"];

const EMPTY_FORM: AdminFormState = {
  username: "",
  email: "",
  password: "",
  role: "VIEWER",
  isActive: true,
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SettingsClient({ user }: { user: AdminSessionUser }) {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [roleFilter, setRoleFilter] = useState<AdminRole | "">("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [form, setForm] = useState<AdminFormState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canUseSettings = user.role === "SUPER_ADMIN";
  const activeFilterParam = useMemo(() => {
    if (activeFilter === "active") {
      return true;
    }
    if (activeFilter === "inactive") {
      return false;
    }
    return undefined;
  }, [activeFilter]);

  const load = useCallback(
    async (page: number) => {
      if (!canUseSettings) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        setError(null);
        const data = await adminFetch<Paginated<AdminAccount>>(
          `/api/admin/admins${buildQuery({
            page,
            pageSize: pagination.pageSize,
            "filterBy[role]": roleFilter || undefined,
            "filterBy[isActive]": activeFilterParam,
          })}`,
        );
        setAdmins(data.items);
        setPagination(data.pagination);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat data admin.");
      } finally {
        setLoading(false);
      }
    },
    [activeFilterParam, canUseSettings, pagination.pageSize, roleFilter],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void load(1);
      }
    });
    return () => {
      active = false;
    };
  }, [load]);

  function startEdit(admin: AdminAccount) {
    setForm({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      password: "",
      role: admin.role,
      isActive: admin.isActive,
    });
  }

  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setNotice(null);
    setError(null);

    const payload = form.id
      ? {
          email: form.email.trim(),
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        }
      : {
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        };

    try {
      if (form.id) {
        await adminFetch<AdminAccount>(`/api/admin/admins/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Akun admin diperbarui.");
      } else {
        await adminFetch<AdminAccount>("/api/admin/admins", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Akun admin dibuat.");
      }
      setForm(null);
      await load(1);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Perubahan admin gagal disimpan.",
      );
    }
  }

  async function toggleActive(admin: AdminAccount) {
    if (admin.id === user.id && admin.isActive) {
      setError("Akun sendiri tidak bisa dinonaktifkan.");
      return;
    }

    setBusyId(admin.id);
    setNotice(null);
    setError(null);
    try {
      await adminFetch<AdminAccount>(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      setNotice(admin.isActive ? "Akun admin dinonaktifkan." : "Akun admin diaktifkan.");
      await load(pagination.page);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Status admin gagal diperbarui.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!canUseSettings) {
    return (
      <EmptyState
        title="Akses dibatasi"
        description="Halaman settings hanya tersedia untuk Super Admin."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-700">Settings</p>
          <h2 className="mt-1 text-2xl font-bold text-neutral-950">Admin Management</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Kelola akun panitia, role RBAC, dan status akses admin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(EMPTY_FORM)}
          className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Tambah Admin
        </button>
      </div>

      <section className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-neutral-500">Role</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as AdminRole | "")}
            className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800"
          >
            <option value="">Semua role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-neutral-500">Status</span>
          <select
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(event.target.value as "all" | "active" | "inactive")
            }
            className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800"
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void load(1)}
            className="h-11 w-full rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Refresh
          </button>
        </div>
      </section>

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={6} />
          </div>
        ) : admins.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Tidak ada admin"
              description="Ubah filter atau buat akun admin baru."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-bold uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {admins.map((admin) => {
                  const isSelf = admin.id === user.id;
                  return (
                    <tr key={admin.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-neutral-950">{admin.username}</div>
                        {isSelf ? (
                          <div className="mt-1 text-xs font-semibold text-indigo-700">
                            Akun aktif
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-neutral-600">{admin.email}</td>
                      <td className="px-4 py-4">
                        <Badge tone={roleTone(admin.role)}>{admin.role}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={admin.isActive ? "success" : "neutral"}>
                          {admin.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-neutral-600">
                        {formatDate(admin.lastLoginAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(admin)}
                            className="h-10 rounded-lg border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(admin)}
                            disabled={(isSelf && admin.isActive) || busyId === admin.id}
                            className="h-10 rounded-lg border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {admin.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>
          Page {pagination.page} dari {Math.max(pagination.totalPages, 1)} - {pagination.total}{" "}
          admin
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="h-10 rounded-lg border border-neutral-200 px-3 font-semibold disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => void load(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="h-10 rounded-lg border border-neutral-200 px-3 font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {form ? (
        <Modal title={form.id ? "Edit Admin" : "Tambah Admin"} onClose={() => setForm(null)}>
          <form onSubmit={submitAdmin} className="space-y-4">
            <Field label="Username">
              <input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                disabled={Boolean(form.id)}
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9_]+"
                className="h-11 w-full rounded-lg border border-neutral-200 px-3 disabled:bg-neutral-100"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                className="h-11 w-full rounded-lg border border-neutral-200 px-3"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.value === "active" })
                  }
                  disabled={form.id === user.id}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 disabled:bg-neutral-100"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </Field>
            </div>
            <Field label={form.id ? "Password Baru" : "Password"}>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required={!form.id}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-neutral-200 px-3"
              />
            </Field>
            <p className="text-xs leading-5 text-neutral-500">
              Password wajib 8-128 karakter dan memiliki huruf kecil, huruf besar, serta angka.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white"
              >
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-800">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
