"use client";

import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Alert } from "@/components/common/Alert";
import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SidePanel } from "@/components/common/SidePanel";
import { SkeletonCard } from "@/components/common/Skeleton";
import { MAX_CANDIDATE_PHOTO_SIZE_BYTES, MAX_CANDIDATE_PHOTO_SIZE_MB } from "@/config/uploads";
import { AdminApiError, adminFetch, buildQuery } from "@/lib/admin/api";
import type { AdminSessionUser, Candidate, ElectionDetail } from "@/lib/admin/types";

interface CandidateFormState {
  id?: string;
  orderNumber: number;
  name: string;
  className: string;
  vision: string;
  missions: string[];
  photo: File | null;
}

type CandidateField = "orderNumber" | "name" | "className" | "vision" | "missions" | "photo";
type CandidateFieldErrors = Partial<Record<CandidateField, string>>;

const EMPTY_FORM: CandidateFormState = {
  orderNumber: 1,
  name: "",
  className: "",
  vision: "",
  missions: [""],
  photo: null,
};

const FIELD_IDS: Record<CandidateField, string> = {
  orderNumber: "candidate-order-number",
  name: "candidate-name",
  className: "candidate-class",
  vision: "candidate-vision",
  missions: "candidate-mission-0",
  photo: "candidate-photo",
};

export function CandidatesClient({
  electionId,
  user,
}: {
  electionId: string;
  user: AdminSessionUser;
}) {
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [form, setForm] = useState<CandidateFormState | null>(null);
  const [formBaseline, setFormBaseline] = useState<CandidateFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CandidateFieldErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const canManage = user.role !== "VIEWER" && election?.status === "SETUP";
  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return candidates;
    }
    return candidates.filter((candidate) =>
      [candidate.name, candidate.className, String(candidate.orderNumber)].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [candidates, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [electionData, candidateData] = await Promise.all([
        adminFetch<ElectionDetail>(`/api/admin/elections/${electionId}`),
        adminFetch<{ items: Candidate[] }>(`/api/admin/candidates${buildQuery({ electionId })}`),
      ]);
      setElection(electionData);
      setCandidates(candidateData.items);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat kandidat.");
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

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!highlightedId) {
      return;
    }
    const timeout = window.setTimeout(() => setHighlightedId(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [highlightedId]);

  useLayoutEffect(() => {
    if (!formError) {
      return;
    }

    formErrorRef.current?.focus({ preventScroll: true });
    formErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [formError]);

  function closeFormImmediately() {
    setForm(null);
    setFormBaseline(null);
    setFormError(null);
    setFieldErrors({});
    setConfirmDiscard(false);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
  }

  function requestCloseForm() {
    if (submitting) {
      return;
    }
    if (form && formBaseline && isCandidateFormDirty(form, formBaseline)) {
      setConfirmDiscard(true);
      return;
    }
    closeFormImmediately();
  }

  function openCreateForm() {
    const nextForm = { ...EMPTY_FORM, missions: [""], orderNumber: nextOrderNumber(candidates) };
    setForm(nextForm);
    setFormBaseline({ ...nextForm, missions: [...nextForm.missions] });
    setFormError(null);
    setFieldErrors({});
    setPhotoError(null);
    setNotice(null);
  }

  function clearFieldError(field: CandidateField) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  function setPhotoFile(file: File | null) {
    if (!form) {
      return;
    }

    setPhotoError(null);
    if (!file) {
      setForm({ ...form, photo: null });
      setPhotoPreviewUrl(null);
      clearFieldError("photo");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Pilih foto berformat JPG, PNG, atau WEBP.");
      setFieldErrors((current) => ({ ...current, photo: "Format foto belum didukung." }));
      focusCandidateField("photo");
      return;
    }

    if (file.size > MAX_CANDIDATE_PHOTO_SIZE_BYTES) {
      setPhotoError(
        `Ukuran foto maksimal ${MAX_CANDIDATE_PHOTO_SIZE_MB} MB. Kompres foto lalu pilih kembali.`,
      );
      setFieldErrors((current) => ({
        ...current,
        photo: `Ukuran foto melebihi ${MAX_CANDIDATE_PHOTO_SIZE_MB} MB.`,
      }));
      focusCandidateField("photo");
      return;
    }

    setForm({ ...form, photo: file });
    clearFieldError("photo");
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function editCandidate(candidate: Candidate) {
    const nextForm: CandidateFormState = {
      id: candidate.id,
      orderNumber: candidate.orderNumber,
      name: candidate.name,
      className: candidate.className,
      vision: candidate.vision,
      missions: candidate.missions.length ? candidate.missions : [""],
      photo: null,
    };
    setPhotoPreviewUrl(null);
    setPhotoError(null);
    setForm(nextForm);
    setFormBaseline({ ...nextForm, missions: [...nextForm.missions] });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    if (submitting) {
      return;
    }

    const validationErrors = validateCandidateForm(form, election?.mode, candidates);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError(null);
      const firstInvalid = candidateFieldOrder.find((field) => validationErrors[field]);
      if (firstInvalid) {
        focusCandidateField(firstInvalid);
      }
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
    setPhotoError(null);

    const payload = {
      electionId,
      orderNumber: form.orderNumber,
      name: form.name.trim(),
      className: form.className.trim(),
      vision: form.vision.trim(),
      missions: form.missions.map((mission) => mission.trim()).filter(Boolean),
    };

    try {
      let saved = form.id
        ? await adminFetch<Candidate>(`/api/admin/candidates/${form.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              orderNumber: payload.orderNumber,
              name: payload.name,
              className: payload.className,
              vision: payload.vision,
              missions: payload.missions,
            }),
          })
        : await adminFetch<Candidate>("/api/admin/candidates", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (form.photo) {
        const formData = new FormData();
        formData.set("photo", form.photo);
        try {
          saved = await adminFetch<Candidate>(`/api/admin/candidates/${saved.id}/photo`, {
            method: "POST",
            body: formData,
          });
        } catch (uploadError) {
          setCandidates((current) => upsertCandidate(current, saved));
          setForm((current) => (current ? { ...current, id: saved.id } : current));
          setFormBaseline((current) =>
            current ? { ...current, id: saved.id, photo: null } : current,
          );
          setFormError(
            "Data kandidat sudah tersimpan, tetapi fotonya belum berhasil diunggah. Periksa foto lalu tekan Simpan lagi.",
          );
          setPhotoError(humanizeCandidateError(uploadError, "upload").message);
          setFieldErrors({ photo: "Foto belum berhasil diunggah." });
          focusCandidateField("photo");
          return;
        }
      }

      setCandidates((current) => upsertCandidate(current, saved));
      setHighlightedId(saved.id);
      closeFormImmediately();
      setNotice(
        form.id
          ? `Perubahan kandidat "${saved.name}" berhasil disimpan.`
          : `Kandidat "${saved.name}" berhasil ditambahkan.`,
      );
    } catch (submitError) {
      const friendlyError = humanizeCandidateError(submitError, "save");
      if (friendlyError.field) {
        setFieldErrors((current) => ({
          ...current,
          [friendlyError.field as CandidateField]: friendlyError.message,
        }));
        focusCandidateField(friendlyError.field);
      } else {
        setFormError(friendlyError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCandidate() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminFetch<{ deletedId: string }>(`/api/admin/candidates/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setCandidates((current) => current.filter((candidate) => candidate.id !== deleteTarget.id));
      setNotice(`Kandidat "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
    } catch (deleteFailure) {
      setDeleteError(humanizeCandidateError(deleteFailure, "delete").message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/elections/${electionId}`}
        className="text-sm font-semibold text-[var(--color-primary-700)] hover:underline"
      >
        Kembali ke detail election
      </Link>

      <AdminPageHeader
        eyebrow={election?.title ?? "Election"}
        title="Kandidat"
        description={
          election?.mode === "WEIGHTED_FIVE"
            ? "Mode berbobot membutuhkan tepat 5 kandidat sebelum election bisa READY."
            : "Kelola kandidat bebas; minimal dua kandidat diperlukan sebelum election bisa READY."
        }
      >
        {election ? (
          <Badge tone={electionStatusTone(election.status)}>{election.status}</Badge>
        ) : null}
        {canManage ? (
          <button
            type="button"
            onClick={openCreateForm}
            disabled={election?.mode === "WEIGHTED_FIVE" && candidates.length >= 5}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
          >
            <Plus aria-hidden="true" size={17} />
            Tambah Kandidat
          </button>
        ) : null}
      </AdminPageHeader>

      {election && election.status !== "SETUP" ? (
        <Alert tone="warning" title="Mode baca saja">
          Kandidat tidak dapat diubah setelah election keluar dari SETUP.
        </Alert>
      ) : null}
      {election?.mode === "WEIGHTED_FIVE" && candidates.length !== 5 ? (
        <Alert tone="info" title="Prasyarat belum lengkap">
          Mode berbobot harus memiliki tepat 5 kandidat. Saat ini ada {candidates.length} kandidat.
        </Alert>
      ) : election?.mode === "STANDARD" && candidates.length < 2 ? (
        <Alert tone="info" title="Prasyarat belum lengkap">
          Minimal 2 kandidat diperlukan sebelum election bisa ditandai READY.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger" title="Kandidat gagal diproses">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert tone="success" title="Berhasil">
          {notice}
        </Alert>
      ) : null}

      {candidates.length > 0 ? (
        <section className="rounded-lg border border-red-100 bg-white p-4 shadow-sm shadow-red-950/5">
          <label htmlFor="candidate-search" className="sr-only">
            Cari kandidat
          </label>
          <div className="relative max-w-md">
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              id="candidate-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, kelas, atau nomor urut"
              className="h-11 w-full rounded-lg border border-neutral-200 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
            />
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Belum ada kandidat"
          description="Tambahkan kandidat pertama agar profil, visi, misi, dan foto dapat disiapkan sebelum voting."
          action={
            canManage ? (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 font-semibold text-[var(--color-primary-700)]"
              >
                <Plus aria-hidden="true" size={17} />
                Tambah Kandidat Pertama
              </button>
            ) : null
          }
        />
      ) : filteredCandidates.length === 0 ? (
        <EmptyState
          title="Kandidat tidak ditemukan"
          description={`Tidak ada kandidat yang cocok dengan “${search.trim()}”. Coba kata kunci lain.`}
          action={
            <button
              type="button"
              onClick={() => setSearch("")}
              className="font-semibold text-[var(--color-primary-700)]"
            >
              Hapus pencarian
            </button>
          }
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCandidates.map((candidate) => (
            <article
              key={candidate.id}
              className={`rounded-lg border bg-white p-5 shadow-sm transition ${
                highlightedId === candidate.id
                  ? "border-emerald-300 ring-2 ring-emerald-200 shadow-emerald-950/10"
                  : "border-red-100 shadow-red-950/5"
              }`}
            >
              <div className="flex items-start gap-4">
                {candidate.photoUrl ? (
                  <Image
                    src={candidate.photoUrl}
                    alt={`Foto ${candidate.name}`}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-lg bg-red-50 text-xl font-bold text-[var(--color-primary-700)]">
                    {candidate.orderNumber}
                  </div>
                )}
                <div>
                  <Badge tone="primary">No. {candidate.orderNumber}</Badge>
                  <h3 className="mt-2 text-lg font-semibold text-neutral-950">{candidate.name}</h3>
                  <p className="text-sm text-neutral-500">{candidate.className}</p>
                </div>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-700">
                {candidate.vision}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                {candidate.missions.slice(0, 2).map((mission) => (
                  <li key={mission}>- {mission}</li>
                ))}
              </ul>
              {canManage ? (
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editCandidate(candidate)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-semibold hover:bg-neutral-50"
                  >
                    <Pencil aria-hidden="true" size={15} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(candidate);
                    }}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    Hapus
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}

      {form ? (
        <SidePanel
          title={form.id ? "Edit Kandidat" : "Tambah Kandidat"}
          description={
            form.id
              ? "Perbarui profil kandidat. Perubahan hanya dapat dilakukan saat election masih SETUP."
              : "Lengkapi profil yang akan ditampilkan kepada pemilih."
          }
          onClose={requestCloseForm}
          initialFocusRef={nameInputRef}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={requestCloseForm}
                disabled={submitting}
                className="h-11 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="candidate-form"
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-vote-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? (
                  <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                ) : null}
                {submitting
                  ? form.id
                    ? "Menyimpan perubahan..."
                    : "Menambahkan kandidat..."
                  : form.id
                    ? "Simpan Perubahan"
                    : "Tambah Kandidat"}
              </button>
            </div>
          }
        >
          <form id="candidate-form" onSubmit={submitCandidate} noValidate className="space-y-6">
            {formError ? (
              <div ref={formErrorRef} tabIndex={-1} className="outline-none">
                <Alert tone="danger" title="Kandidat belum dapat disimpan">
                  {formError}
                </Alert>
              </div>
            ) : null}

            <section aria-labelledby="candidate-profile-heading" className="space-y-4">
              <div>
                <h3 id="candidate-profile-heading" className="text-sm font-bold text-neutral-950">
                  Identitas kandidat
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Nama, kelas, dan nomor urut akan terlihat oleh pemilih.
                </p>
              </div>
              <Field
                label="Nama lengkap"
                htmlFor={FIELD_IDS.name}
                error={fieldErrors.name}
                required
              >
                <input
                  ref={nameInputRef}
                  id={FIELD_IDS.name}
                  value={form.name}
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value });
                    clearFieldError("name");
                  }}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? FIELD_IDS.name + "-error" : undefined}
                  className={candidateInputClass(Boolean(fieldErrors.name))}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nomor urut"
                  htmlFor={FIELD_IDS.orderNumber}
                  error={fieldErrors.orderNumber}
                  required
                >
                  <input
                    id={FIELD_IDS.orderNumber}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={election?.mode === "WEIGHTED_FIVE" ? 5 : 100}
                    value={form.orderNumber}
                    onChange={(event) => {
                      setForm({ ...form, orderNumber: Number(event.target.value) });
                      clearFieldError("orderNumber");
                    }}
                    aria-invalid={Boolean(fieldErrors.orderNumber)}
                    aria-describedby={
                      fieldErrors.orderNumber ? FIELD_IDS.orderNumber + "-error" : undefined
                    }
                    className={candidateInputClass(Boolean(fieldErrors.orderNumber))}
                  />
                </Field>
                <Field
                  label="Kelas"
                  htmlFor={FIELD_IDS.className}
                  error={fieldErrors.className}
                  required
                >
                  <input
                    id={FIELD_IDS.className}
                    value={form.className}
                    onChange={(event) => {
                      setForm({ ...form, className: event.target.value });
                      clearFieldError("className");
                    }}
                    aria-invalid={Boolean(fieldErrors.className)}
                    aria-describedby={
                      fieldErrors.className ? FIELD_IDS.className + "-error" : undefined
                    }
                    className={candidateInputClass(Boolean(fieldErrors.className))}
                  />
                </Field>
              </div>
            </section>

            <section
              aria-labelledby="candidate-program-heading"
              className="space-y-4 border-t border-neutral-200 pt-6"
            >
              <div>
                <h3 id="candidate-program-heading" className="text-sm font-bold text-neutral-950">
                  Program kandidat
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Gunakan kalimat yang jelas dan mudah dipahami oleh pemilih.
                </p>
              </div>
              <Field
                label="Visi"
                htmlFor={FIELD_IDS.vision}
                error={fieldErrors.vision}
                description="Minimal 10 karakter."
                required
              >
                <textarea
                  id={FIELD_IDS.vision}
                  value={form.vision}
                  onChange={(event) => {
                    setForm({ ...form, vision: event.target.value });
                    clearFieldError("vision");
                  }}
                  rows={4}
                  aria-invalid={Boolean(fieldErrors.vision)}
                  aria-describedby={
                    fieldErrors.vision
                      ? FIELD_IDS.vision + "-error"
                      : FIELD_IDS.vision + "-description"
                  }
                  className={candidateInputClass(Boolean(fieldErrors.vision), "min-h-28 py-3")}
                />
              </Field>
              <Field
                label="Misi"
                htmlFor={FIELD_IDS.missions}
                error={fieldErrors.missions}
                description="Tambahkan 1–10 poin. Setiap poin minimal 5 karakter."
                required
              >
                <div className="space-y-3">
                  {form.missions.map((mission, index) => {
                    const missionId = "candidate-mission-" + index;
                    return (
                      <div key={index} className="flex items-start gap-2">
                        <span className="grid h-11 w-8 shrink-0 place-items-center text-sm font-semibold text-neutral-500">
                          {index + 1}.
                        </span>
                        <input
                          id={missionId}
                          value={mission}
                          onChange={(event) => {
                            const missions = [...form.missions];
                            missions[index] = event.target.value;
                            setForm({ ...form, missions });
                            clearFieldError("missions");
                          }}
                          aria-label={"Misi " + (index + 1)}
                          aria-invalid={Boolean(fieldErrors.missions)}
                          aria-describedby={
                            fieldErrors.missions
                              ? FIELD_IDS.missions + "-error"
                              : FIELD_IDS.missions + "-description"
                          }
                          className={candidateInputClass(
                            Boolean(fieldErrors.missions),
                            "min-w-0 flex-1",
                          )}
                        />
                        <button
                          type="button"
                          title={"Hapus misi " + (index + 1)}
                          aria-label={"Hapus misi " + (index + 1)}
                          onClick={() => {
                            const missions = form.missions.filter(
                              (_, missionIndex) => missionIndex !== index,
                            );
                            setForm({ ...form, missions: missions.length ? missions : [""] });
                            clearFieldError("missions");
                          }}
                          disabled={form.missions.length === 1}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, missions: [...form.missions, ""] });
                      clearFieldError("missions");
                    }}
                    disabled={form.missions.length >= 10}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    <Plus aria-hidden="true" size={16} />
                    Tambah Poin Misi
                  </button>
                </div>
              </Field>
            </section>

            <section
              aria-labelledby="candidate-photo-heading"
              className="space-y-4 border-t border-neutral-200 pt-6"
            >
              <div>
                <h3 id="candidate-photo-heading" className="text-sm font-bold text-neutral-950">
                  Foto kandidat
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Opsional. Gunakan JPG, PNG, atau WEBP maksimal {MAX_CANDIDATE_PHOTO_SIZE_MB} MB.
                </p>
              </div>
              <Field label="Foto" htmlFor={FIELD_IDS.photo} error={fieldErrors.photo}>
                <label
                  htmlFor={FIELD_IDS.photo}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setPhotoFile(event.dataTransfer.files.item(0));
                  }}
                  className={candidateDropzoneClass(Boolean(fieldErrors.photo))}
                >
                  {photoPreviewUrl ? (
                    <Image
                      src={photoPreviewUrl}
                      alt="Preview foto kandidat"
                      width={160}
                      height={160}
                      unoptimized
                      className="h-32 w-32 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="font-semibold">Pilih atau drop foto kandidat</span>
                  )}
                  <span className="mt-2 text-xs text-neutral-500">
                    JPG, PNG, WEBP · maksimal {MAX_CANDIDATE_PHOTO_SIZE_MB} MB
                  </span>
                  <input
                    id={FIELD_IDS.photo}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                    aria-invalid={Boolean(fieldErrors.photo)}
                    aria-describedby={fieldErrors.photo ? FIELD_IDS.photo + "-error" : undefined}
                    className="sr-only"
                  />
                </label>
                {photoError ? <p className="mt-2 text-sm text-red-700">{photoError}</p> : null}
              </Field>
            </section>
          </form>
        </SidePanel>
      ) : null}

      {deleteTarget ? (
        <Modal
          title="Hapus kandidat?"
          onClose={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        >
          <p className="text-sm leading-6 text-neutral-700">
            Kandidat <strong>{deleteTarget.name}</strong> akan dihapus permanen dari election ini.
            Tindakan ini tidak dapat dibatalkan.
          </p>
          {deleteError ? (
            <div className="mt-4">
              <Alert tone="danger" title="Kandidat belum dapat dihapus">
                {deleteError}
              </Alert>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void deleteCandidate()}
              disabled={deleting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
            >
              {deleting ? (
                <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" size={16} />
              )}
              {deleting ? "Menghapus..." : "Hapus Kandidat"}
            </button>
          </div>
        </Modal>
      ) : null}

      {confirmDiscard ? (
        <Modal title="Buang perubahan?" onClose={() => setConfirmDiscard(false)}>
          <p className="text-sm leading-6 text-neutral-700">
            Informasi yang belum disimpan akan hilang. Kamu dapat kembali ke form untuk melanjutkan
            pengisian.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
            >
              Kembali ke Form
            </button>
            <button
              type="button"
              onClick={closeFormImmediately}
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
            >
              Buang Perubahan
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  description,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  description?: string | undefined;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-neutral-800">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-red-600">
              *
            </span>
            <span className="sr-only"> wajib</span>
          </>
        ) : null}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={htmlFor + "-error"} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : description ? (
        <p id={htmlFor + "-description"} className="mt-2 text-xs leading-5 text-neutral-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

const candidateFieldOrder: CandidateField[] = [
  "name",
  "orderNumber",
  "className",
  "vision",
  "missions",
  "photo",
];

function validateCandidateForm(
  form: CandidateFormState,
  mode: "STANDARD" | "WEIGHTED_FIVE" | undefined,
  candidates: Candidate[],
) {
  const errors: CandidateFieldErrors = {};
  const maxOrder = mode === "WEIGHTED_FIVE" ? 5 : 100;
  if (!Number.isInteger(form.orderNumber) || form.orderNumber < 1 || form.orderNumber > maxOrder) {
    errors.orderNumber =
      mode === "WEIGHTED_FIVE"
        ? "Nomor urut harus berupa angka 1 sampai 5."
        : "Nomor urut harus berupa angka 1 sampai 100.";
  } else if (
    candidates.some(
      (candidate) => candidate.id !== form.id && candidate.orderNumber === form.orderNumber,
    )
  ) {
    errors.orderNumber = "Nomor urut ini sudah dipakai kandidat lain.";
  }

  const name = form.name.trim();
  if (!name) {
    errors.name = "Nama lengkap wajib diisi.";
  } else if (name.length < 2) {
    errors.name = "Nama lengkap minimal 2 karakter.";
  } else if (name.length > 255) {
    errors.name = "Nama lengkap maksimal 255 karakter.";
  }

  const className = form.className.trim();
  if (!className) {
    errors.className = "Kelas kandidat wajib diisi.";
  } else if (className.length > 50) {
    errors.className = "Kelas maksimal 50 karakter.";
  }

  const vision = form.vision.trim();
  if (!vision) {
    errors.vision = "Visi kandidat wajib diisi.";
  } else if (vision.length < 10) {
    errors.vision = "Visi minimal 10 karakter agar cukup jelas.";
  } else if (vision.length > 1000) {
    errors.vision = "Visi maksimal 1.000 karakter.";
  }

  const missions = form.missions.map((mission) => mission.trim()).filter(Boolean);
  if (missions.length === 0) {
    errors.missions = "Tambahkan minimal satu poin misi.";
  } else if (missions.length > 10) {
    errors.missions = "Misi maksimal 10 poin.";
  } else if (missions.some((mission) => mission.length < 5)) {
    errors.missions = "Setiap poin misi minimal 5 karakter.";
  } else if (missions.some((mission) => mission.length > 500)) {
    errors.missions = "Setiap poin misi maksimal 500 karakter.";
  }

  if (form.photo && !["image/jpeg", "image/png", "image/webp"].includes(form.photo.type)) {
    errors.photo = "Pilih foto berformat JPG, PNG, atau WEBP.";
  } else if (form.photo && form.photo.size > MAX_CANDIDATE_PHOTO_SIZE_BYTES) {
    errors.photo = `Ukuran foto maksimal ${MAX_CANDIDATE_PHOTO_SIZE_MB} MB.`;
  }

  return errors;
}

function humanizeCandidateError(
  error: unknown,
  operation: "save" | "upload" | "delete",
): { message: string; field?: CandidateField } {
  if (error instanceof AdminApiError) {
    if (error.code === "ORDER_NUMBER_TAKEN") {
      return { message: "Nomor urut ini sudah dipakai kandidat lain.", field: "orderNumber" };
    }
    if (error.code === "ELECTION_MAX_CANDIDATES") {
      return { message: "Election ini sudah memiliki batas maksimal 5 kandidat." };
    }
    if (error.code === "ELECTION_WRONG_STATE") {
      return {
        message: "Kandidat hanya dapat diubah saat election masih berstatus SETUP.",
      };
    }
    if (error.code === "CANDIDATE_HAS_VOTES") {
      return {
        message: "Kandidat ini tidak dapat dihapus karena sudah memiliki suara.",
      };
    }
    if (error.code === "CANDIDATE_NOT_FOUND") {
      return {
        message: "Kandidat tidak ditemukan atau sudah dihapus. Muat ulang halaman lalu coba lagi.",
      };
    }
    if (error.code === "VALIDATION_ERROR") {
      const field = firstServerValidationField(error.details);
      if (field) {
        return {
          field,
          message: serverValidationMessage(field),
        };
      }
      return { message: "Periksa kembali data kandidat yang ditandai, lalu coba simpan lagi." };
    }
    if (error.code === "INTERNAL_ERROR" || error.status >= 500) {
      return {
        message:
          operation === "upload"
            ? "Foto belum dapat diunggah karena server sedang bermasalah. Coba lagi beberapa saat."
            : "Kandidat belum dapat diproses karena server sedang bermasalah. Coba lagi beberapa saat.",
      };
    }
  }

  if (error instanceof TypeError) {
    return {
      message:
        "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi tanpa menutup form.",
    };
  }

  if (operation === "upload") {
    return { message: "Foto belum berhasil diunggah. Pilih ulang foto lalu coba lagi." };
  }
  if (operation === "delete") {
    return { message: "Kandidat belum berhasil dihapus. Coba lagi." };
  }
  return { message: "Kandidat belum berhasil disimpan. Periksa data lalu coba lagi." };
}

function firstServerValidationField(details: unknown): CandidateField | undefined {
  if (!details || typeof details !== "object") {
    return undefined;
  }
  for (const field of candidateFieldOrder) {
    if (field in details) {
      return field;
    }
  }
  return undefined;
}

function serverValidationMessage(field: CandidateField) {
  const messages: Record<CandidateField, string> = {
    orderNumber: "Periksa nomor urut kandidat.",
    name: "Periksa nama lengkap kandidat.",
    className: "Periksa kelas kandidat.",
    vision: "Visi harus berisi 10 sampai 1.000 karakter.",
    missions: "Tambahkan 1 sampai 10 poin misi yang valid.",
    photo: "Periksa format dan ukuran foto kandidat.",
  };
  return messages[field];
}

function focusCandidateField(field: CandidateField) {
  window.setTimeout(() => {
    const element = document.getElementById(FIELD_IDS[field]);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
}

function isCandidateFormDirty(form: CandidateFormState, baseline: CandidateFormState) {
  return (
    form.orderNumber !== baseline.orderNumber ||
    form.name !== baseline.name ||
    form.className !== baseline.className ||
    form.vision !== baseline.vision ||
    form.missions.join("\n") !== baseline.missions.join("\n") ||
    form.photo !== null
  );
}

function nextOrderNumber(candidates: Candidate[]) {
  const used = new Set(candidates.map((candidate) => candidate.orderNumber));
  let order = 1;
  while (used.has(order)) {
    order += 1;
  }
  return order;
}

function upsertCandidate(candidates: Candidate[], saved: Candidate) {
  return [...candidates.filter((candidate) => candidate.id !== saved.id), saved].sort(
    (first, second) => first.orderNumber - second.orderNumber,
  );
}

function candidateInputClass(invalid: boolean, extra = "") {
  return [
    "h-11 w-full rounded-lg border px-3 text-neutral-950 outline-none transition focus:ring-2",
    invalid
      ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200"
      : "border-neutral-200 focus:border-[var(--color-primary-600)] focus:ring-[var(--color-primary-600)]",
    extra,
  ].join(" ");
}

function candidateDropzoneClass(invalid: boolean) {
  return [
    "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm transition focus-within:ring-2",
    invalid
      ? "border-red-400 bg-red-50 text-red-800 focus-within:ring-red-200"
      : "border-red-200 bg-red-50/40 text-neutral-600 hover:bg-red-50 focus-within:ring-[var(--color-primary-600)]",
  ].join(" ");
}
