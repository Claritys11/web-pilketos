"use client";

import { Eye, EyeOff, KeyRound, LoaderCircle, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Alert } from "@/components/common/Alert";
import { Badge, roleTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SkeletonTable } from "@/components/common/Skeleton";
import { AdminApiError, adminFetch, buildQuery } from "@/lib/admin/api";
import type { AdminAccount, AdminRole, AdminSessionUser, Paginated } from "@/lib/admin/types";

interface AdminFormState {
  id?: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: AdminRole;
  isActive: boolean;
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type AdminFormField = "username" | "email" | "password" | "confirmPassword";
type AdminFormErrors = Partial<Record<AdminFormField, string>>;

const ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "VIEWER"];

const EMPTY_FORM: AdminFormState = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "VIEWER",
  isActive: true,
};

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
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
  const [formErrors, setFormErrors] = useState<AdminFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    setFormErrors({});
    setFormError(null);
    setShowPassword(false);
    setForm({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      password: "",
      confirmPassword: "",
      role: admin.role,
      isActive: admin.isActive,
    });
  }

  function startCreate() {
    setFormErrors({});
    setFormError(null);
    setShowPassword(false);
    setForm({ ...EMPTY_FORM });
  }

  function clearAdminFormError(field: AdminFormField) {
    setFormErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setNotice(null);
    setError(null);
    setFormError(null);

    const validationErrors = validateAdminForm(form);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setFormError("Periksa kembali field yang ditandai.");
      return;
    }

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
      setSavingAdmin(true);
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
      if (submitError instanceof AdminApiError) {
        if (submitError.code === "ADMIN_USERNAME_TAKEN") {
          setFormErrors({ username: "Username sudah digunakan akun lain." });
        } else if (submitError.code === "ADMIN_EMAIL_TAKEN") {
          setFormErrors({ email: "Email sudah digunakan akun lain." });
        }
      }
      setFormError(
        submitError instanceof Error ? submitError.message : "Perubahan admin gagal disimpan.",
      );
    } finally {
      setSavingAdmin(false);
    }
  }

  async function changeOwnPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordForm) {
      return;
    }

    setPasswordError(null);
    const passwordValidationError = validatePassword(passwordForm.newPassword);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak sama.");
      return;
    }

    try {
      setChangingPassword(true);
      await adminFetch<{ changed: true }>("/api/admin/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm(null);
      setNotice(
        "Password akun Anda berhasil diganti. Gunakan password baru saat login berikutnya.",
      );
    } catch (changeError) {
      setPasswordError(
        changeError instanceof Error ? changeError.message : "Password gagal diganti.",
      );
    } finally {
      setChangingPassword(false);
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
      <AdminPageHeader
        eyebrow="Settings"
        title="Admin Management"
        description="Kelola akun panitia, role RBAC, dan status akses admin. Gunakan VIEWER untuk pemantau yang tidak boleh mengubah data."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPasswordError(null);
              setShowPassword(false);
              setPasswordForm({ ...EMPTY_PASSWORD_FORM });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <KeyRound aria-hidden="true" size={17} />
            Ganti Password Saya
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)]"
          >
            <Plus aria-hidden="true" size={17} />
            Tambah Admin
          </button>
        </div>
      </AdminPageHeader>

      <Alert tone="info" title="Role akses">
        SUPER_ADMIN mengelola semua akun, ADMIN mengelola election/kandidat/token, VIEWER hanya
        membaca dashboard dan audit.
      </Alert>

      <section className="grid gap-3 rounded-lg border border-red-100 bg-white p-4 shadow-sm shadow-red-950/5 sm:grid-cols-3">
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

      {notice || error ? (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))]"
        >
          {notice ? (
            <Alert tone="success" title="Berhasil">
              {notice}
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="danger" title="Settings gagal diproses">
              {error}
            </Alert>
          ) : null}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-red-100 bg-white shadow-sm shadow-red-950/5">
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
              <thead className="bg-red-50/70 text-left text-xs font-bold uppercase text-neutral-500">
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
                          <div className="mt-1 text-xs font-semibold text-[var(--color-primary-700)]">
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
        <Modal
          title={form.id ? "Edit Admin" : "Tambah Admin"}
          onClose={() => {
            if (!savingAdmin) {
              setForm(null);
            }
          }}
        >
          <form onSubmit={submitAdmin} className="space-y-4">
            {formError ? (
              <Alert tone="danger" title="Admin gagal disimpan">
                {formError}
              </Alert>
            ) : null}
            <Field label="Username" error={formErrors.username}>
              <input
                value={form.username}
                onChange={(event) => {
                  setForm({ ...form, username: event.target.value });
                  clearAdminFormError("username");
                }}
                disabled={Boolean(form.id)}
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9_]+"
                aria-invalid={Boolean(formErrors.username)}
                className="h-11 w-full rounded-lg border border-neutral-200 px-3 disabled:bg-neutral-100"
              />
            </Field>
            <Field label="Email" error={formErrors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(event) => {
                  setForm({ ...form, email: event.target.value });
                  clearAdminFormError("email");
                }}
                required
                maxLength={255}
                aria-invalid={Boolean(formErrors.email)}
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
            {form.id === user.id ? (
              <Alert tone="info" title="Password akun Anda">
                Gunakan tombol Ganti Password Saya agar perubahan diverifikasi dengan password saat
                ini.
              </Alert>
            ) : (
              <>
                <Field
                  label={form.id ? "Password Baru (opsional)" : "Password"}
                  error={formErrors.password}
                >
                  <PasswordInput
                    value={form.password}
                    visible={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    onChange={(value) => {
                      setForm({ ...form, password: value });
                      clearAdminFormError("password");
                    }}
                    required={!form.id}
                  />
                </Field>
                <Field label="Konfirmasi Password" error={formErrors.confirmPassword}>
                  <PasswordInput
                    value={form.confirmPassword}
                    visible={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    onChange={(value) => {
                      setForm({ ...form, confirmPassword: value });
                      clearAdminFormError("confirmPassword");
                    }}
                    required={!form.id || Boolean(form.password)}
                  />
                </Field>
                <p className="text-xs leading-5 text-neutral-500">
                  Gunakan 8-128 karakter dengan huruf kecil, huruf besar, dan angka.
                </p>
              </>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={savingAdmin}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingAdmin}
                className="inline-flex h-10 min-w-24 items-center justify-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60"
              >
                {savingAdmin ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
                ) : null}
                {savingAdmin ? "Menyimpan" : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {passwordForm ? (
        <Modal
          title="Ganti Password Saya"
          onClose={() => {
            if (!changingPassword) {
              setPasswordForm(null);
            }
          }}
        >
          <form onSubmit={changeOwnPassword} className="space-y-4">
            {passwordError ? (
              <Alert tone="danger" title="Password gagal diganti">
                {passwordError}
              </Alert>
            ) : null}
            <Field label="Password Saat Ini">
              <PasswordInput
                value={passwordForm.currentPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
                onChange={(value) => {
                  setPasswordForm({ ...passwordForm, currentPassword: value });
                  setPasswordError(null);
                }}
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="Password Baru">
              <PasswordInput
                value={passwordForm.newPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
                onChange={(value) => {
                  setPasswordForm({ ...passwordForm, newPassword: value });
                  setPasswordError(null);
                }}
                required
              />
            </Field>
            <Field label="Konfirmasi Password Baru">
              <PasswordInput
                value={passwordForm.confirmPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
                onChange={(value) => {
                  setPasswordForm({ ...passwordForm, confirmPassword: value });
                  setPasswordError(null);
                }}
                required
              />
            </Field>
            <p className="text-xs leading-5 text-neutral-500">
              Password baru harus berbeda dan menggunakan 8-128 karakter dengan huruf kecil, huruf
              besar, dan angka.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPasswordForm(null)}
                disabled={changingPassword}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={changingPassword}
                className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60"
              >
                {changingPassword ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
                ) : null}
                {changingPassword ? "Mengganti" : "Ganti Password"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-800">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <span className="mt-1 block text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}

function PasswordInput({
  value,
  visible,
  required,
  autoComplete = "new-password",
  onChange,
  onToggle,
}: {
  value: string;
  visible: boolean;
  required?: boolean;
  autoComplete?: "current-password" | "new-password";
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={required || value ? 8 : undefined}
        maxLength={128}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-lg border border-neutral-200 px-3 pr-11"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        title={visible ? "Sembunyikan password" : "Tampilkan password"}
        className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        {visible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
      </button>
    </div>
  );
}

function validateAdminForm(form: AdminFormState): AdminFormErrors {
  const errors: AdminFormErrors = {};
  if (!form.id && !/^[A-Za-z0-9_]{3,50}$/.test(form.username.trim())) {
    errors.username = "Gunakan 3-50 karakter berupa huruf, angka, atau underscore.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.length > 255) {
    errors.email = "Masukkan alamat email yang valid.";
  }
  if (!form.id && !form.password) {
    errors.password = "Password wajib diisi.";
  } else if (form.password) {
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      errors.password = passwordError;
    }
    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak sama.";
    }
  }
  return errors;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password minimal 8 karakter.";
  }
  if (password.length > 128) {
    return "Password maksimal 128 karakter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Tambahkan minimal satu huruf kecil.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Tambahkan minimal satu huruf besar.";
  }
  if (!/[0-9]/.test(password)) {
    return "Tambahkan minimal satu angka.";
  }
  return null;
}
