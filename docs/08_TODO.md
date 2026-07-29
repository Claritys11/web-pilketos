# 08 — Implementation Tracker (TODO)

> **Status:** ACTIVE — Living Document
> **Version:** 1.0.0
> **Last Updated:** 2026-07-29
> **References:** PRD v1.1.0 · DB Design v1.0.0 · System Architecture v1.1.0 · API Spec v1.0.0 · UI/UX Spec v1.0.0 · Security v1.0.0 · Testing v1.0.0 · Roadmap v1.0.0
> **Scope:** Granular task list for system implementation — v1

---

## Purpose

Dokumen ini adalah **Implementation Tracker (TODO)** resmi yang digunakan untuk memantau kemajuan pengembangan sistem Pilketos E-Voting. Dokumen ini bertindak sebagai alat kontrol kualitas operasional yang mengurai setiap modul teknis dari roadmap ke dalam tugas-tugas (tasks) yang sangat kecil, granular, jelas, dan dapat didelegasikan langsung kepada tim pengembang.

Setiap penyelesaian tugas wajib diverifikasi terhadap kriteria Definition of Done (DoD) sebelum dicentang.

---

## Progress Dashboard

### Overall Progress

```
[█████████████████░░░] 85%
```

### Progress Status Legend

- ⬜ **Not Started** (Belum dimulai)
- 🟨 **In Progress** (Sedang dikerjakan)
- 🟩 **Done** (Selesai dan terverifikasi)
- 🟥 **Blocked** (Terhambat oleh dependensi lain)

### Section Progress Summary

| Modul / Fase                 | Progress         | Status         | Target Developer   |
| ---------------------------- | ---------------- | -------------- | ------------------ |
| Phase 0 — Project Setup      | `12 / 12` (100%) | 🟩 Done        | DevOps / Tech Lead |
| Phase 1 — Database Layer     | `10 / 10` (100%) | 🟩 Done        | Database Engineer  |
| Phase 2 — Authentication     | `10 / 12` (83%)  | 🟨 In Progress | Backend Developer  |
| Phase 3 — Business Services  | `23 / 24` (96%)  | 🟨 In Progress | Backend Developer  |
| Phase 4 — API route handlers | `25 / 25` (100%) | 🟩 Done        | Backend Developer  |
| Phase 5 — Student UI         | `28 / 28` (100%) | 🟩 Done        | Frontend Developer |
| Phase 6 — Admin UI           | `32 / 32` (100%) | 🟩 Done        | Frontend Developer |
| Phase 7 — Security Hardening | `12 / 12` (100%) | 🟩 Done        | SecOps / Backend   |
| Phase 8 — Testing & QA       | `0 / 16` (0%)    | ⬜ Not Started | QA Tester          |
| Phase 9 — Deployment         | `2 / 12` (17%)   | 🟨 In Progress | DevOps             |
| Documentation Sync           | `4 / 5` (80%)    | 🟨 In Progress | Technical Writer   |

---

## Phase 0 — Project Setup

Fase inisiasi repositori, framework Next.js, standardisasi penulisan kode, dan konfigurasi environment.

- [x] **TS-00-01:** Buat repositori Git baru di platform repositori sekolah. 🟩
- [x] **TS-00-02:** Atur branch protection rule untuk `main` (wajib Pull Request, lolos CI build, min 1 approval). 🟩
- [x] **TS-00-03:** Inisiasi Next.js 16+ menggunakan `npx create-next-app@latest` dengan konfigurasi: App Router, TypeScript, ESLint, Src Directory, TailwindCSS. 🟩
- [x] **TS-00-04:** Konfigurasi `"strict": true` di `tsconfig.json` dan tambahkan aturan no implicit any. 🟩
- [x] **TS-00-05:** Inisiasi library UI shadcn/ui menggunakan `npx shadcn-ui@latest init` dan konfigurasikan layout global css. 🟩
- [x] **TS-00-06:** Konfigurasi rules ESLint untuk Next.js dan TypeScript strict checking di `.eslintrc.json`. 🟩
- [x] **TS-00-07:** Konfigurasi `.prettierrc` dan `.prettierignore` untuk konsistensi formatting kode. 🟩
- [x] **TS-00-08:** Setup tools git-hooks Husky dan lint-staged untuk memicu otomatis prettier formatting dan linting sesaat sebelum commit. 🟩
- [x] **TS-00-09:** Setup Dockerfile multi-stage build untuk containerisasi Next.js production environment. 🟩
- [x] **TS-00-10:** Buat file `.env.example` yang mencantumkan seluruh kunci rahasia yang dibutuhkan aplikasi. 🟩
- [x] **TS-00-11:** Tulis modul validasi terpusat environment variable di `src/config/env.ts` menggunakan schema validation Zod. 🟩
- [x] **TS-00-12:** Implementasikan abstraction layer logger (`src/lib/logger/index.ts`) dan buat `ConsoleLogger` sebagai implementasi default. 🟩

---

## Phase 1 — Database Layer

Membangun representasi database fisik PostgreSQL berdasarkan rancangan database Prisma.

- [x] **TS-01-01:** Buat file skema Prisma `prisma/schema.prisma`. 🟩
- [x] **TS-01-02:** Definisikan tipe data, fields, relasi, dan default values untuk tabel `Admin` di Prisma. 🟩
- [x] **TS-01-03:** Definisikan skema untuk tabel `Election` (status enums: SETUP, READY, OPEN, PAUSED, CLOSED, ARCHIVED). 🟩
- [x] **TS-01-04:** Definisikan skema untuk tabel `Candidate` (orderNumber 1-5 constraint). 🟩
- [x] **TS-01-05:** Definisikan skema untuk tabel `VotingToken` (kolom token_hash HMAC-SHA256, used_at nullable). 🟩
- [x] **TS-01-06:** Definisikan skema untuk tabel `Vote` (tanpa FK ke VotingToken, hanya ke election dan candidate). 🟩
- [x] **TS-01-07:** Definisikan skema untuk tabel `AuditLog` (kolom actor, action, result, IP, UA, metadata JSON). 🟩
- [x] **TS-01-08:** Buat file migrasi SQL manual untuk disisipkan ke Prisma migrations:
  - SQL script untuk membuat partial unique index `status` pada tabel `Election` (hanya status OPEN/PAUSED yang unik). 🟩
  - SQL script untuk membuat constraint unique gabungan `election_id` dan `order_number` pada tabel `Candidate`. 🟩
- [x] **TS-01-09:** Eksekusi migrasi database ke lokal/dev menggunakan command `npx prisma migrate dev`. 🟩
- [x] **TS-01-10:** Tulis skrip data seeder `prisma/seed.ts` untuk mengisi akun Super Admin default dan election dummy dengan 3 kandidat. 🟩

---

## Phase 2 — Authentication

Membangun backend authentication, integrasi Argon2id hashing, NextAuth middleware, dan otorisasi RBAC.

- [x] **TS-02-01:** Integrasikan library hashing password Argon2id di folder `src/lib/auth/argon.ts`. 🟩
- [ ] **TS-02-02:** Tulis unit test untuk memverifikasi fungsionalitas hashing password (match/no-match). ⬜
- [x] **TS-02-03:** Inisiasi NextAuth (Auth.js) v5 dengan Credentials Provider di `src/app/api/auth/[...nextauth]/route.ts`. 🟩
- [x] **TS-02-04:** Konfigurasi NextAuth JWT token handler untuk menyertakan `role` dan `id` admin ke dalam payload. 🟩
- [x] **TS-02-05:** Atur parameter NextAuth session lifetime selama 8 jam dengan cookie secure flags (HttpOnly, Secure, SameSite=Lax). 🟩
- [x] **TS-02-06:** Hubungkan `verifyPassword` Argon2id ke dalam metode `authorize` credentials provider. 🟩
- [x] **TS-02-07:** Implementasikan `src/proxy.ts` untuk mencegat akses tidak sah ke area admin (`/admin/*`). 🟩 Implemented as `src/proxy.ts` because Next.js 16 renamed Middleware to Proxy.
- [x] **TS-02-08:** Tambahkan rules otorisasi di middleware untuk membatasi route settings (`/admin/settings`) hanya bagi role `SUPER_ADMIN`. 🟩
- [x] **TS-02-09:** Tambahkan logika security headers injection pada Next.js Proxy (formerly Middleware) (CSP, HSTS, X-Frame-Options, X-Content-Type, Referrer Policy). 🟩
- [ ] **TS-02-10:** Tulis uji integrasi untuk memastikan admin dengan role `VIEWER` diblokir (403) saat mencoba mengakses route admin settings. ⬜
- [x] **TS-02-11:** Konfigurasikan penanganan kegagalan autentikasi di NextAuth login route agar mengembalikan pesan error generik (anti-user enumeration). 🟩
- [x] **TS-02-12:** Implementasikan logout handler API untuk menghapus session cookie dari browser admin. 🟩 Provided by Auth.js `POST /api/auth/signout`.

---

---

## Phase 3 — Business Services

Implementasi business logic inti yang terisolasi di folder `src/services/`.

### 1. AuditService (`src/services/audit.service.ts`)

- [x] **TS-03-01:** Implementasikan fungsi `writeLog()` untuk menyimpan log audit administratif ke database secara append-only. 🟩
- [x] **TS-03-02:** Pastikan fungsi penulisan log tidak menerima update/delete perintah (Prisma update/delete diblokir). 🟩

### 2. TokenService (`src/services/token.service.ts`)

- [x] **TS-03-03:** Implementasikan generator token plaintext random menggunakan secure cryptographic random string (min 12 chars). 🟩
- [x] **TS-03-04:** Implementasikan fungsi `generateTokenBatch()` yang menghitung hash HMAC-SHA256 untuk setiap token dan menyimpannya dalam satu transaksi database Prisma (TX-3). 🟩
- [x] **TS-03-05:** Pastikan token plaintext dikembalikan dalam response generator batch untuk satu kali tampilan, kemudian memori dibersihkan. 🟩
- [x] **TS-03-06:** Implementasikan fungsi `validateToken()` yang mencocokkan input token plaintext siswa dengan hash database dan memastikan status election `OPEN`. 🟩

### 3. VoteService (`src/services/vote.service.ts`)

- [x] **TS-03-07:** Implementasikan fungsi `castVote()` untuk pencatatan suara siswa. 🟩
- [x] **TS-03-08:** Masukkan perintah penguncian baris (`FOR UPDATE`) pada pencarian token di awal transaksi database (TX-1). 🟩
- [x] **TS-03-09:** Tambahkan logika validasi token belum digunakan (`used_at IS NULL`) di dalam transaksi. 🟩
- [x] **TS-03-10:** Hubungkan penulisan suara baru ke tabel `Vote` (tanpa link FK ke token) di dalam transaksi. 🟩
- [x] **TS-03-11:** Perbarui status token (`used_at = now()`) di dalam transaksi. 🟩
- [x] **TS-03-12:** Panggil `AuditService` setelah transaksi commit berhasil untuk mencatat event `VOTE_CAST` tanpa menyimpan detail token/pilihan. 🟩

### 4. ElectionService (`src/services/election.service.ts`)

- [x] **TS-03-13:** Implementasikan fungsi standard CRUD election. 🟩
- [x] **TS-03-14:** Tulis logika transisi state machine status election (`transitionStatus`) di dalam transaksi database (TX-2). 🟩
- [x] **TS-03-15:** Berikan validasi prasyarat minimal 2 kandidat dan 1 token sebelum status diizinkan beralih ke `READY`. 🟩
- [x] **TS-03-16:** Buat constraint check sebelum state diubah ke `OPEN` agar tidak ada election aktif lain. 🟩

### 5. CandidateService (`src/services/candidate.service.ts`)

- [x] **TS-03-17:** Implementasikan fungsi CRUD kandidat. 🟩
- [x] **TS-03-18:** Tambahkan validasi batas maksimum kandidat (5) per election di dalam service. 🟩
- [x] **TS-03-19:** Hubungkan integrasi method `uploadFile` dan `deleteFile` dari `StorageService` untuk mengelola berkas foto kandidat. 🟩

### 6. AdminService (`src/services/admin.service.ts`) & Abstractions

- [x] **TS-03-20:** Implementasikan fungsi kelola pengguna admin (create, update role, toggle status). 🟩
- [x] **TS-03-21:** Tambahkan aturan validasi Super Admin tidak boleh menonaktifkan dirinya sendiri. 🟩
- [x] **TS-03-22:** Buat custom hooks/helper `StorageService` menggunakan SDK Supabase Storage (`src/lib/storage/supabase.ts`). 🟩
- [x] **TS-03-23:** Buat mock local storage implementation untuk pengujian lokal (`src/lib/storage/local.ts`). 🟩
- [ ] **TS-03-24:** Buat unit test integrasi untuk seluruh service logic di atas. ⬜

---

## Phase 4 — API Route Handlers

Membangun endpoint API di folder `src/app/api/` berdasarkan kontrak spesifikasi API.

### 1. Voting API

- [x] **TS-04-01:** Implementasikan `POST /api/vote/validate-token` (panggil `TokenService.validateToken`). 🟩
- [x] **TS-04-02:** Implementasikan `POST /api/vote/cast` (panggil `VoteService.castVote`). 🟩

### 2. Authentication API

- [x] **TS-04-03:** Konfigurasikan endpoint NextAuth default `/api/auth/[...nextauth]` route. 🟩

### 3. Election API

- [x] **TS-04-04:** Implementasikan `GET /api/admin/elections` (list dengan status filters & pagination). 🟩
- [x] **TS-04-05:** Implementasikan `POST /api/admin/elections` (buat election baru state SETUP). 🟩
- [x] **TS-04-06:** Implementasikan `GET /api/admin/elections/[id]` (detail dengan candidates list). 🟩
- [x] **TS-04-07:** Implementasikan `PATCH /api/admin/elections/[id]/status` (panggil `ElectionService.transitionStatus`). 🟩
- [x] **TS-04-08:** Implementasikan `DELETE /api/admin/elections/[id]` (hanya jika state SETUP/ARCHIVED). 🟩

### 4. Candidate API

- [x] **TS-04-09:** Implementasikan `GET /api/admin/candidates` (list diurutkan by orderNumber). 🟩
- [x] **TS-04-10:** Implementasikan `POST /api/admin/candidates` (buat kandidat baru, election status SETUP). 🟩
- [x] **TS-04-11:** Implementasikan `PATCH /api/admin/candidates/[id]` (update field kandidat). 🟩
- [x] **TS-04-12:** Implementasikan `DELETE /api/admin/candidates/[id]` (hanya jika status SETUP dan suara nol). 🟩
- [x] **TS-04-13:** Implementasikan `POST /api/admin/candidates/[id]/photo` (unggah berkas foto kandidat). 🟩

### 5. Token API

- [x] **TS-04-14:** Implementasikan `POST /api/admin/tokens/generate` (panggil `TokenService.generateTokenBatch`). 🟩
- [x] **TS-04-15:** Implementasikan `GET /api/admin/tokens/export` (export token metadata CSV). 🟩

### 6. Dashboard & Audit API

- [x] **TS-04-16:** Implementasikan `GET /api/admin/dashboard/stats` (mengembalikan aggregate data COUNT, no raw vote lists). 🟩
- [x] **TS-04-17:** Implementasikan `GET /api/admin/audit` (list log audit dengan filters & pagination). 🟩

### 7. Admin API & Infrastructure

- [x] **TS-04-18:** Implementasikan `GET /api/admin/admins` (list admin, Super Admin access only). 🟩
- [x] **TS-04-19:** Implementasikan `POST /api/admin/admins` (buat admin baru dengan Argon2 hash password). 🟩
- [x] **TS-04-20:** Implementasikan `PATCH /api/admin/admins/[id]` (update data admin / deaktifasi). 🟩
- [x] **TS-04-21:** Implementasikan `GET /api/health` (kembalikan operational metrics: DB, Storage, Uptime). 🟩
- [x] **TS-04-22:** Tambahkan layer Zod schema validation pada request body setiap endpoint di atas. 🟩
- [x] **TS-04-23:** Pastikan format output error API seragam `{ success: false, error: { code, message } }`. 🟩
- [ ] **TS-04-24:** Buat pengujian integrasi otomatis untuk memverifikasi kontrak API. ⬜
- [x] **TS-04-25:** Pastikan database connection pooling ditutup dengan benar di akhir pemrosesan API. 🟩 Prisma singleton/adapter digunakan untuk route runtime; koneksi tidak dibuat ulang dan tidak diputus per-request.

---

## Phase 5 — Student UI

Mengimplementasikan antarmuka untuk alur siswa pemilih di folder `src/app/vote/`.

### 1. Layout & Token Input Page

- [x] **TS-05-01:** Implementasikan global layout pemilih (`src/app/vote/layout.tsx`) dengan skema warna `--color-vote-surface`. 🟩
- [x] **TS-05-02:** Buat stepper progress bar component (`src/components/voting/Stepper.tsx`) linear stepper. 🟩
- [x] **TS-05-03:** Buat landing page token input (`/vote/page.tsx`). 🟩
- [x] **TS-05-04:** Tambahkan field input token dengan auto-trim whitespace dan auto-uppercase formatting. 🟩
- [x] **TS-05-05:** Tampilkan inline error warning jika API token validation mengembalikan status invalid/terpakai. 🟩

### 2. Fullscreen Gate & Control

- [x] **TS-05-06:** Buat halaman Fullscreen Gate (`/vote/fullscreen/page.tsx`). 🟩
- [x] **TS-05-07:** Hubungkan pemicu Fullscreen API (`requestFullscreen()`) saat tombol "Mulai Voting" diklik. 🟩
- [x] **TS-05-08:** Buat fallback modal / panel petunjuk manual (tekan tombol F11) jika API fullscreen ditolak oleh browser. 🟩
- [x] **TS-05-09:** Hubungkan pemicu Keyboard Lock API (`navigator.keyboard.lock()`) saat fullscreen sukses (best effort). 🟩

### 3. Candidate Selection

- [x] **TS-05-10:** Buat halaman daftar kandidat (`/vote/candidates/page.tsx`). 🟩
- [x] **TS-05-11:** Implementasikan responsif kandidat grid (1 kolom mobile, 2-3 kolom desktop). 🟩
- [x] **TS-05-12:** Buat card komponen kandidat dengan data foto, nomor urut, nama, dan ringkasan visi misi. 🟩
- [x] **TS-05-13:** Buat modal detail kandidat (`src/components/voting/CandidateDetailModal.tsx`) untuk membaca visi & semua misi lengkap. 🟩
- [x] **TS-05-14:** Implementasikan status highlight terpilih pada card kandidat saat diklik. 🟩
- [x] **TS-05-15:** Buat fixed bottom action bar untuk navigasi tombol "Lanjut" (disabled jika belum ada kandidat terpilih). 🟩

### 4. Fullscreen Interruption Overlay

- [x] **TS-05-16:** Buat custom hooks `useFullscreen` untuk mendeteksi event `fullscreenchange`, `visibilitychange`, dan `blur`. 🟩
- [x] **TS-05-17:** Buat komponen `FullscreenOverlay.tsx` dengan backdrop blur dan pointer-events blocker. 🟩
- [x] **TS-05-18:** Tampilkan overlay interupsi saat terdeteksi siswa keluar dari mode fullscreen atau memindahkan fokus tab browser. 🟩
- [x] **TS-05-19:** Hubungkan tombol "Kembali ke Layar Penuh" di overlay untuk memicu ulang fullscreen dan menyembunyikan overlay. 🟩

### 5. Confirmation & Done Screen

- [x] **TS-05-20:** Buat halaman konfirmasi pilihan (`/vote/confirm/page.tsx`). 🟩
- [x] **TS-05-21:** Tampilkan ringkasan data kandidat terpilih (foto, nomor urut, nama, kelas). 🟩
- [x] **TS-05-22:** Tambahkan tombol konfirmasi kirim suara dengan logic double-click prevention. 🟩
- [x] **TS-05-23:** Sediakan tombol "Kembali Pilih Ulang" untuk mengembalikan siswa ke daftar kandidat tanpa kehilangan state. 🟩
- [x] **TS-05-24:** Buat halaman sukses voting (`/vote/done/page.tsx`). 🟩
- [x] **TS-05-25:** Tambahkan animasi spring checkmark sukses dan pesan terima kasih. 🟩
- [x] **TS-05-26:** Buat progress bar countdown visual selama 3 detik. 🟩
- [x] **TS-05-27:** Picu keluar fullscreen (`document.exitFullscreen()`) dan redirect kembali ke halaman utama `/vote` saat countdown habis. 🟩
- [x] **TS-05-28:** Pastikan data state voting siswa dibersihkan total dari client state (sessionStorage/React state). 🟩

---

---

## Phase 6 — Admin UI

Mengimplementasikan antarmuka untuk domain admin di folder `src/app/admin/`.

### 1. General Panel & Login

- [x] **TS-06-01:** Buat global layout admin (`src/app/admin/layout.tsx`) dengan navigasi sidebar responsif dan topbar breadcrumbs. 🟩
- [x] **TS-06-02:** Buat halaman login admin (`/admin/login/page.tsx`). 🟩
- [x] **TS-06-03:** Tambahkan input password field dengan toggle show/hide (Lucide Eye/EyeOff icon). 🟩
- [x] **TS-06-04:** Tampilkan error alert generik di form login jika autentikasi ditolak. 🟩

### 2. Election CRUD

- [x] **TS-06-05:** Buat halaman list election (`/admin/elections/page.tsx`) berisi tabel election, badge status, dan pagination. 🟩
- [x] **TS-06-06:** Buat modal form pembuatan election baru ( SETUP state ). 🟩
- [x] **TS-06-07:** Buat halaman detail election (`/admin/elections/[id]/page.tsx`) dengan tabs (Ringkasan, Kandidat, Token, Audit). 🟩
- [x] **TS-06-08:** Buat panel kontrol state machine (tombol "Tandai Siap", "Buka Voting", "Jeda", "Tutup", "Arsipkan"). 🟩
- [x] **TS-06-09:** Tambahkan modal konfirmasi sebelum perintah perubahan status status dieksekusi. 🟩

### 3. Candidate Management

- [x] **TS-06-10:** Buat sub-halaman kelola kandidat (`/admin/elections/[id]/candidates/page.tsx`). 🟩
- [x] **TS-06-11:** Sembunyikan semua tombol tambah/edit/hapus jika status election bukan `SETUP`. 🟩
- [x] **TS-06-12:** Buat slide-over panel dari kanan untuk form tambah/edit data kandidat (nomor urut, nama, kelas, visi, misi). 🟩
- [x] **TS-06-13:** Integrasikan area file upload untuk unggah foto kandidat (drag & drop, MIME validation, format preview). 🟩
- [x] **TS-06-14:** Sediakan tombol hapus kandidat dengan modal konfirmasi keselamatan. 🟩

### 4. Token Management

- [x] **TS-06-15:** Buat sub-halaman token manager (`/admin/elections/[id]/tokens/page.tsx`). 🟩
- [x] **TS-06-16:** Tampilkan panel statistik token (Total, Digunakan, Sisa, Partisipasi %). 🟩
- [x] **TS-06-17:** Buat modal generator token batch (input jumlah token). 🟩
- [x] **TS-06-18:** Buat modal post-generate token (tampilan satu kali plaintext tokens list). 🟩
- [x] **TS-06-19:** Hubungkan pemicu download CSV token plaintext otomatis sesaat setelah token sukses di-generate. 🟩

### 5. Dashboard & Projector Mode

- [x] **TS-06-20:** Buat halaman dashboard utama (`/admin/dashboard/page.tsx`). 🟩
- [x] **TS-06-21:** Implementasikan hook `useDashboardPolling` untuk auto-update statistik dashboard setiap 3-5 detik saat tab aktif. 🟩
- [x] **TS-06-22:** Buat chart visualisasi perolehan suara per kandidat menggunakan horizontal CSS bar chart. 🟩
- [x] **TS-06-23:** Implementasikan toggle Projector Mode / Live Mode (menyembunyikan sidebar, topbar, dan kontrol admin). 🟩
- [x] **TS-06-24:** Sediakan tombol exit projector mode di sudut bawah layar. 🟩

### 6. Audit Log & Settings

- [x] **TS-06-25:** Buat halaman audit log (`/admin/audit/page.tsx`) berisi tabel log aktivitas. 🟩
- [x] **TS-06-26:** Tambahkan filter bar (Action type, Actor, Result, Date picker range). 🟩
- [x] **TS-06-27:** Jadikan tabel baris log audit dapat diklik untuk menampilkan expand data detail metadata JSON. 🟩
- [x] **TS-06-28:** Buat halaman pengaturan pengguna admin (`/admin/settings/page.tsx`) khusus Super Admin. 🟩
- [x] **TS-06-29:** Buat form modal tambah/edit admin (Username, Email, Role, Ganti Password). 🟩
- [x] **TS-06-30:** Sediakan tombol nonaktifkan admin dengan logic validation bypass pencegahan _self-deactivation_. 🟩
- [x] **TS-06-31:** Buat reusable skeleton components (`SkeletonCard`, `SkeletonTable`) untuk layout stability saat loading data. 🟩
- [x] **TS-06-32:** Tampilkan visual empty states di setiap halaman tabel / list jika tidak ada data yang dimuat. 🟩

---

## Phase 7 — Security Hardening

Implementasi pengerasan keamanan aplikasi pra-rilis.

- [x] **TS-07-01:** Verifikasi Next.js Proxy (formerly Middleware) menyisipkan header CSP terenkripsi ketat tanpa inline scripts pihak ketiga. 🟩 Verified via production smoke on port 6504.
- [x] **TS-07-02:** Pastikan header Strict-Transport-Security (HSTS) disematkan dengan benar pada HTTPS. 🟩 `Strict-Transport-Security: max-age=31536000; includeSubDomains` verified.
- [x] **TS-07-03:** Aktifkan rate limiter middleware pada endpoint API login admin (`/api/auth/signin`). 🟩 Also covers Auth.js credentials callback; request ke-6 terkena 429.
- [x] **TS-07-04:** Aktifkan rate limiter pada endpoint validasi token (`/api/vote/validate-token`) dan vote cast (`/api/vote/cast`). 🟩 Token validation request ke-11 terkena 429.
- [x] **TS-07-05:** Pastikan format input divalidasi ketat dengan Zod schemas pada route handlers sebelum data diteruskan ke Service layer. 🟩 Body, query, and route params use Zod schemas.
- [x] **TS-07-06:** Konfigurasikan library Helmet atau set header manual untuk pertahanan clickjacking (`X-Frame-Options: DENY`). 🟩 Manual security headers are injected from Proxy and next.config.
- [x] **TS-07-07:** Implementasikan validasi ganda file upload foto kandidat (ekstensi file, MIME type, magic bytes verification). 🟩 Upload route validates extension, MIME, size, and file signature.
- [x] **TS-07-08:** Buat utilitas auto-rename file acak menggunakan CUID sebelum foto kandidat di-upload ke Supabase Storage. 🟩 Candidate photos use random CUID-style storage names.
- [x] **TS-07-09:** Set access rule Supabase Storage bucket candidate-photos ke public read-only, write/delete restricted. 🟩 Production SQL policy provided in `docs/supabase-storage-policy.sql`.
- [x] **TS-07-10:** Pastikan token plaintext siswa tidak pernah dicatat oleh `LoggerService` di log server. 🟩 Verified by code scan; token plaintext is only returned once to admin UI and never logged.
- [x] **TS-07-11:** Konfigurasikan secure session cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax`) pada NextAuth. 🟩 Auth.js session cookie options are explicit.
- [x] **TS-07-12:** Pastikan API `/api/health` mengembalikan status data normal tanpa menampilkan system credentials / paths. 🟩 Health response only returns ok/error service states.

---

## Phase 8 — Testing & QA

Penerapan testing menyeluruh sebelum sistem dirilis.

- [ ] **TS-08-01:** Jalankan unit test otomatis menggunakan Vitest untuk memastikan fungsi utilitas (hashing, formatting, validation) lulus 100%. ⬜
- [ ] **TS-08-02:** Jalankan integration test untuk memastikan logic `VoteService.castVote` commit sukses dan rollback jika input gagal. ⬜
- [ ] **TS-08-03:** Lakukan load testing simulasi kondisi race condition vote (menguji konkurensi token voting sama). ⬜
- [ ] **TS-08-04:** Jalankan E2E testing Playwright untuk happy path alur voting siswa (Token -> Fullscreen -> List -> Confirm -> Done). ⬜
- [ ] **TS-08-05:** Jalankan E2E testing untuk alur admin (Login -> CRUD -> Token Gen -> State Machine -> Stats Update). ⬜
- [ ] **TS-08-06:** Lakukan load testing k6 untuk mensimulasikan beban puncak 500 concurrent users dalam window 15 menit. ⬜
- [ ] **TS-08-07:** Pastikan waktu respon API vote cast di bawah beban puncak berada di bawah batas maksimum 500ms. ⬜
- [ ] **TS-08-08:** Lakukan audit aksesibilitas menggunakan Lighthouse/axe-core untuk memverifikasi kesesuaian kontras warna WCAG AA. ⬜
- [ ] **TS-08-09:** Uji navigasi keyboard penuh (Tab, Space, Enter) untuk seluruh alur voting siswa. ⬜
- [ ] **TS-08-10:** Uji pembacaan screen reader (VoiceOver/NVDA) pada stepper progress dan form validation error. ⬜
- [ ] **TS-08-11:** Uji penetrasi input (injeksi skrip XSS) pada form kandidat untuk memverifikasi layer sanitasi. ⬜
- [ ] **TS-08-12:** Uji penetrasi SQL injection pada input token pemilih. ⬜
- [ ] **TS-08-13:** Verifikasi bypass route API admin terblokir tanpa cookie session NextAuth valid. ⬜
- [ ] **TS-08-14:** Lakukan regression testing setelah perbaikan bug untuk memastikan fungsionalitas lain tidak rusak. ⬜
- [ ] **TS-08-15:** Verifikasi data token plaintext tidak terekspos di database atau logger files produksi. ⬜
- [ ] **TS-08-16:** Buat laporan UAT (User Acceptance Testing) bersama dengan panitia sekolah. ⬜

---

## Phase 9 — Deployment & Go-Live

Checklist deployment sistem ke lingkungan produksi.

- [x] **TS-09-01:** Jalankan kompilasi produksi Next.js `npm run build` lokal untuk memastikan build sukses tanpa error. 🟩
- [ ] **TS-09-02:** Buat database instansi PostgreSQL produksi di platform Supabase. ⬜
- [ ] **TS-09-03:** Konfigurasikan environment variables di platform deployment produksi (Vercel/VPS). ⬜
- [ ] **TS-09-04:** Hubungkan custom domain sekolah (`pilketos.sch.id`) ke platform hosting Next.js. ⬜
- [ ] **TS-09-05:** Pastikan sertifikat SSL/TLS valid aktif di domain produksi (HTTPS enforced). ⬜
- [ ] **TS-09-06:** Jalankan migrasi database ke PostgreSQL produksi menggunakan Prisma CLI dengan direct connection URL. ⬜
- [ ] **TS-09-07:** Jalankan script seeder admin di database produksi. ⬜
- [ ] **TS-09-08:** Masuk ke admin panel produksi dengan kredensial default, lalu ubah password admin default segera. ⬜
- [ ] **TS-09-09:** Konfigurasikan auto-backup database SQL harian terenkripsi ke cloud storage bucket terpisah. ⬜
- [ ] **TS-09-10:** Setup monitoring ketersediaan server (seperti Uptime Robot) mengarah ke `/api/health`. ⬜
- [ ] **TS-09-11:** Setup monitoring error log runtime server (seperti Sentry/Console logs tracker). ⬜
- [x] **TS-09-12:** Jalankan deployment smoke testing (verifikasi login admin dan fungsionalitas website utama setelah rilis). 🟩 Standalone runtime smoke test passed on port 6502; latest Next production smoke on port 6503 verified health 200, admin API guard 401, admin login 200, and vote page 200.

---

## Documentation Tasks

Checklist sinkronisasi dokumentasi proyek.

- [x] **TS-10-01:** Buat file `README.md` utama di repositori yang menjelaskan cara install, setup env, seed, migrate, dan run local development. 🟩
- [x] **TS-10-02:** Dokumentasikan petunjuk penggunaan (User Guide) admin untuk panitia sekolah. 🟩 See `docs/09_ADMIN_USER_GUIDE.md`.
- [x] **TS-10-03:** Pastikan seluruh file panduan `.md` di folder `docs/` disinkronkan dengan status final arsitektur. 🟩 Port lokal dan Next.js Proxy terminology disinkronkan.
- [x] **TS-10-04:** Buat dokumentasi manual petunjuk recovery / troubleshooting jika terjadi crash database. 🟩 README memuat reset volume lokal, migrasi deploy, seed bootstrap, healthcheck, dan catatan operasional.
- [ ] **TS-10-05:** Buat walkthrough video tutorial singkat cara mengunggah foto kandidat dan generate token batch. ⬜

---

## Technical Debt & Nice to Have List

### Known Technical Debt (v1)

| Area              | Detail Debt                                   | Prioritas | Alasan Penundaan                                                  | Owner   | Target Rilis |
| ----------------- | --------------------------------------------- | --------- | ----------------------------------------------------------------- | ------- | ------------ |
| **Rate Limiting** | Memory-based rate limiter (non-Redis)         | Medium    | Skala v1 kecil (~500 pemilih), single instance container cukup.   | Backend | v2.0.0       |
| **Dashboard**     | Polling HTTP 3-5 detik (bukan push WebSocket) | Low       | Lebih mudah di-debug, minim dependency, cukup responsif untuk v1. | UI Dev  | v2.0.0       |
| **Backup**        | SQL dump tidak terenkripsi client-side        | Medium    | Supabase sudah menyediakan basic database backups terenkripsi.    | DevOps  | v1.1.0       |

### Nice to Have Features (v2+)

- [ ] **TS-NH-01:** Integrasi Multi-Factor Authentication (MFA) menggunakan TOTP (Google Authenticator) untuk akun admin. ⬜
- [ ] **TS-NH-02:** Penggunaan Redis untuk rate limiting terdistribusi dan caching dashboard statistics. ⬜
- [ ] **TS-NH-03:** Push-based Realtime Dashboard menggunakan WebSocket (Supabase Realtime). ⬜
- [ ] **TS-NH-04:** Integrasi log keamanan (AuditLog & Error logs) ke platform SIEM (Splunk/ELK Stack). ⬜
- [ ] **TS-NH-05:** Fitur ekspor berkas hasil pemilu secara otomatis ke format PDF bertanda tangan digital. ⬜

---

## Release Checklist (Pre-Production Gate)

Daftar periksa penentu kelayakan rilis sebelum sistem dinyatakan _Live_ di hari pemilihan:

- [ ] **Database:** Migrasi PostgreSQL terpasang sukses, indexes aktif, seeder default admin berhasil diganti password. ⬜
- [ ] **Security:** Security headers (CSP, HSTS) terverifikasi, rate limits aktif, secure session cookies aktif, magic bytes file upload jalan. ⬜
- [ ] **Testing:** Seluruh unit test, integration test, dan E2E test lulus 100% tanpa kegagalan. ⬜
- [ ] **Performance:** Response time `/api/vote/cast` terbukti di bawah 500ms pada simulasi 500 concurrent users. ⬜
- [ ] **Backup:** Skrip backup otomatis harian teruji dan sukses melakukan restore dummy di database staging. ⬜
- [ ] **UAT:** Surat persetujuan UAT ditandatangani oleh TPM dan perwakilan sekolah. ⬜

---

## Post-Release Checklist (Day of Election & Maintenance)

Daftar periksa pemeliharaan setelah sistem aktif digunakan di hari pemilihan:

- [ ] **Monitoring:** Monitor konsumsi memori dan CPU server di cloud console (Vercel/VPS). ⬜
- [ ] **Error tracking:** Periksa dasbor logger untuk mendeteksi kegagalan API 500. ⬜
- [ ] **Audit logs check:** Pastikan aksi admin terekam di tabel AuditLog secara berkala. ⬜
- [ ] **Database check:** Pantau database connections pool limits, pastikan tidak melebihi kapasitas maksimum pool. ⬜
- [ ] **End of election:** Ubah status election ke CLOSED, pastikan perolehan suara terkunci otomatis (read-only mode). ⬜
- [ ] **Archive:** Setelah hasil disetujui, ubah status ke ARCHIVED, lalu matikan polling dashboard stats untuk menghemat server resources. ⬜

---

> **Dokumen TODO ini adalah living tracker.** Developer wajib merubah status task (dari ⬜ menjadi 🟨 atau 🟩) langsung di dokumen ini setiap kali progres pengerjaan berubah. Perubahan besar di luar checklist ini wajib diselaraskan dengan Technical Program Manager.
