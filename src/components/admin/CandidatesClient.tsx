"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Badge, electionStatusTone } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { SidePanel } from "@/components/common/SidePanel";
import { SkeletonCard } from "@/components/common/Skeleton";
import { adminFetch, buildQuery } from "@/lib/admin/api";
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

const EMPTY_FORM: CandidateFormState = {
  orderNumber: 1,
  name: "",
  className: "",
  vision: "",
  missions: [""],
  photo: null,
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
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canManage = user.role !== "VIEWER" && election?.status === "SETUP";

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

  function closeForm() {
    setForm(null);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
  }

  function setPhotoFile(file: File | null) {
    if (!form) {
      return;
    }

    setPhotoError(null);
    if (!file) {
      setForm({ ...form, photo: null });
      setPhotoPreviewUrl(null);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Format foto harus JPG, PNG, atau WEBP.");
      return;
    }

    setForm({ ...form, photo: file });
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function editCandidate(candidate: Candidate) {
    setPhotoPreviewUrl(null);
    setPhotoError(null);
    setForm({
      id: candidate.id,
      orderNumber: candidate.orderNumber,
      name: candidate.name,
      className: candidate.className,
      vision: candidate.vision,
      missions: candidate.missions.length ? candidate.missions : [""],
      photo: null,
    });
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setSubmitting(true);
    setError(null);
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
      const saved = form.id
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
          await adminFetch<Candidate>(`/api/admin/candidates/${saved.id}/photo`, {
            method: "POST",
            body: formData,
          });
        } catch (uploadError) {
          setPhotoError(
            uploadError instanceof Error
              ? `Kandidat tersimpan, tetapi foto gagal diupload: ${uploadError.message}`
              : "Kandidat tersimpan, tetapi foto gagal diupload.",
          );
          await load();
          return;
        }
      }

      closeForm();
      setNotice(`Kandidat "${saved.name}" berhasil disimpan.`);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kandidat gagal disimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCandidate() {
    if (!deleteTarget) {
      return;
    }
    await adminFetch<Candidate>(`/api/admin/candidates/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await load();
  }

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
          <h2 className="mt-1 text-2xl font-bold text-neutral-950">Kandidat</h2>
          {election ? (
            <div className="mt-2">
              <Badge tone={electionStatusTone(election.status)}>{election.status}</Badge>
            </div>
          ) : null}
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM, orderNumber: candidates.length + 1 })}
            disabled={candidates.length >= 5}
            className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Tambah Kandidat
          </button>
        ) : null}
      </div>

      {election && election.status !== "SETUP" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Kandidat tidak dapat diubah setelah election keluar dari SETUP.
        </div>
      ) : null}
      {candidates.length < 2 ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-800">
          Minimal 2 kandidat diperlukan sebelum election bisa ditandai READY.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
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
          description="Tambahkan kandidat saat election masih SETUP."
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {candidates.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
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
                  <div className="grid h-20 w-20 place-items-center rounded-lg bg-emerald-50 text-xl font-bold text-emerald-700">
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
                    className="h-10 flex-1 rounded-lg border border-neutral-200 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(candidate)}
                    className="h-10 flex-1 rounded-lg border border-red-200 text-sm font-semibold text-red-700"
                  >
                    Hapus
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}

      {form ? (
        <SidePanel title={form.id ? "Edit Kandidat" : "Tambah Kandidat"} onClose={closeForm}>
          <form onSubmit={submitCandidate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomor Urut">
                <select
                  value={form.orderNumber}
                  onChange={(event) =>
                    setForm({ ...form, orderNumber: Number(event.target.value) })
                  }
                  className="h-11 w-full rounded-lg border border-neutral-200 px-3"
                >
                  {[1, 2, 3, 4, 5].map((number) => (
                    <option key={number} value={number}>
                      {number}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Kelas">
                <input
                  value={form.className}
                  onChange={(event) => setForm({ ...form, className: event.target.value })}
                  className="h-11 w-full rounded-lg border border-neutral-200 px-3"
                />
              </Field>
            </div>
            <Field label="Nama Lengkap">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="h-11 w-full rounded-lg border border-neutral-200 px-3"
              />
            </Field>
            <Field label="Visi">
              <textarea
                value={form.vision}
                onChange={(event) => setForm({ ...form, vision: event.target.value })}
                rows={4}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
              />
            </Field>
            <Field label="Misi">
              <div className="space-y-2">
                {form.missions.map((mission, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={mission}
                      onChange={(event) => {
                        const missions = [...form.missions];
                        missions[index] = event.target.value;
                        setForm({ ...form, missions });
                      }}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const missions = form.missions.filter(
                          (_, missionIndex) => missionIndex !== index,
                        );
                        setForm({ ...form, missions: missions.length ? missions : [""] });
                      }}
                      className="h-11 rounded-lg border border-neutral-200 px-3 text-sm font-semibold"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, missions: [...form.missions, ""] })}
                  className="h-10 rounded-lg border border-neutral-200 px-3 text-sm font-semibold"
                >
                  Tambah Misi
                </button>
              </div>
            </Field>
            <Field label="Foto">
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setPhotoFile(event.dataTransfer.files.item(0));
                }}
                className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-600 hover:bg-neutral-100"
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
                <span className="mt-2 text-xs text-neutral-500">JPG, PNG, atau WEBP</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
              {photoError ? (
                <p className="mt-2 text-sm font-semibold text-red-700">{photoError}</p>
              ) : null}
            </Field>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </SidePanel>
      ) : null}

      {deleteTarget ? (
        <Modal title="Hapus Kandidat" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm leading-6 text-neutral-700">
            Hapus kandidat <strong>{deleteTarget.name}</strong>?
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="h-10 rounded-lg border border-neutral-200 px-4 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void deleteCandidate()}
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white"
            >
              Ya, Hapus
            </button>
          </div>
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
