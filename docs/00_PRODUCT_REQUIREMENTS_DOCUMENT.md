# 00 — Product Requirements Document (PRD)

> **Status:** FINAL — Source of Truth  
> **Version:** 1.1.0  
> **Last Updated:** 2026-07-27  
> **Authors:** Product Manager · Senior Software Architect · Cybersecurity Engineer  
> **Scope:** E-Voting Ketua OSIS berbasis Web — v1
>
> **Changelog v1.1.0:** Hapus Hash Chain dari v1 (pindah ke v2); perluas Fullscreen Enforcement (Keyboard Lock API + fallbacks + browser compatibility); perkuat Audit Log (append-only, immutable); ubah token hashing ke HMAC-SHA256; perjelas arsitektur autentikasi admin vs siswa.

---

## Purpose

Dokumen ini adalah **source of truth** tunggal untuk seluruh sistem E-Voting Ketua OSIS. Semua dokumen turunan (arsitektur, database, API, keamanan, dll.) harus mengacu dan konsisten dengan dokumen ini. Perubahan requirement **hanya sah** jika direvisi di sini terlebih dahulu, kemudian dipropagasi ke dokumen turunan yang terdampak.

---

## Overview

**Pilketos** adalah sistem pemilihan Ketua OSIS berbasis web yang dirancang untuk digunakan di lingkungan sekolah (satu sekolah, satu pemilihan aktif dalam satu waktu). Sistem ini memungkinkan siswa memilih melalui **token anonim** tanpa perlu membuat akun, sementara panitia/admin mengelola seluruh proses dari dashboard terpusat yang dilindungi autentikasi.

### Nilai Inti Sistem

| Nilai             | Penjelasan                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Integritas**    | Setiap suara dijamin melalui transaksi atomik, constraint database, dan audit log append-only |
| **Anonimitas**    | Tidak ada cara teknis untuk mengkorelasikan token ke kandidat yang dipilih                    |
| **Transparansi**  | Audit log detail setiap aksi admin, hasil visible setelah election tutup                      |
| **Aksesibilitas** | Siswa tidak butuh akun; cukup token yang diterima dari panitia                                |
| **Keamanan UX**   | Fullscreen enforcement sebagai deterrent perilaku curang                                      |

---

## Requirements

### 1. User Roles & Domain

#### 1.1 Pembagian Domain

Sistem ini terdiri dari **dua domain yang sepenuhnya terpisah** dan tidak saling bergantung:

| Domain          | Pengguna              | Metode Akses        | Lokasi     |
| --------------- | --------------------- | ------------------- | ---------- |
| **Voting**      | Siswa pemilih         | Token sekali pakai  | `/vote`    |
| **Admin Panel** | Panitia/Admin sekolah | Login berbasis akun | `/admin/*` |

> **Keputusan desain:** Pemisahan domain yang ketat memastikan tidak ada jalur teknis yang menghubungkan identitas siswa dengan pilihan mereka.

#### 1.2 Role Admin (RBAC — 3 Tingkat)

| Role        | Kode          | Deskripsi                                                                                               |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| Super Admin | `SUPER_ADMIN` | Tingkat tertinggi. Kelola akun admin, hapus election, restore backup.                                   |
| Admin       | `ADMIN`       | Operasional harian. CRUD kandidat, generate token, kontrol state election, lihat dashboard & audit log. |
| Viewer      | `VIEWER`      | Read-only. Hanya bisa melihat dashboard, hasil, dan export laporan.                                     |

#### 1.3 Permission Matrix

| Aksi                         | `SUPER_ADMIN` | `ADMIN` | `VIEWER` |
| ---------------------------- | :-----------: | :-----: | :------: |
| Kelola akun admin (CRUD)     |      ✅       |   ❌    |    ❌    |
| Hapus election (hard delete) |      ✅       |   ❌    |    ❌    |
| Restore backup               |      ✅       |   ❌    |    ❌    |
| Akses `/admin/settings`      |      ✅       |   ❌    |    ❌    |
| CRUD kandidat                |      ✅       |   ✅    |    ❌    |
| Generate & distribusi token  |      ✅       |   ✅    |    ❌    |
| Kontrol state election       |      ✅       |   ✅    |    ❌    |
| Ekspor data (CSV)            |      ✅       |   ✅    |    ✅    |
| Lihat dashboard & hasil      |      ✅       |   ✅    |    ✅    |
| Lihat audit log              |      ✅       |   ✅    |    ✅    |
| Toggle Live Dashboard mode   |      ✅       |   ✅    |    ❌    |

---

### 2. Manajemen Kandidat

- Admin memilih mode election: **kandidat bebas** (minimal 2) atau **5 kandidat berbobot** (tepat 5).
- Mode 5 kandidat menghitung skor per kandidat dari persentase internal tiap kelompok: OSIS 40%,
  MPK 30%, dan GURU 30%.
- Setiap kandidat memiliki atribut:
  - **Nomor urut** (integer, unik dalam election)
  - **Foto** (upload gambar)
  - **Nama lengkap**
  - **Kelas**
  - **Visi** (teks singkat, tampil di card)
  - **Misi** (list, tampil preview — maks. 2 item di card, selebihnya via modal "Lihat Selengkapnya")

---

### 3. Manajemen Token

- Token dibangkitkan oleh admin dalam batch (misalnya: 200 token untuk 200 siswa).
- Setiap token **hanya bisa digunakan satu kali** (`used_at` di-set saat vote terkonfirmasi).
- Token disimpan di database dalam bentuk **HMAC-SHA256(token, SERVER_SECRET)**, bukan plaintext. Penggunaan keyed hash (bukan SHA-256 polos) mencegah verifikasi token yang bocor jika database dikompromikan tanpa akses ke secret.
- Admin menerima token plaintext dalam format CSV untuk didistribusikan ke siswa.
- Token **tidak terikat ke identitas siswa tertentu** secara desain.

---

### 4. Alur Voting (Student Journey)

```
[Halaman Token]
    |
    v Input token
[Validasi Token]  ---- Invalid/Sudah Dipakai ----> [Error State]
    |
    v Valid
[Paksa Fullscreen]
    |
    v Fullscreen aktif
[Daftar Kandidat] -- (Card Layout, Progress Stepper: Token -> Kandidat -> Konfirmasi -> Selesai)
    |
    +---> [Detail Kandidat] (opsional, modal/halaman detail)
    |         |
    |         +---> Kembali ke Daftar Kandidat
    |
    v Pilih kandidat
[Konfirmasi Pilihan]
    |
    v Submit
[Halaman Terima Kasih]
    |
    v Countdown 3 detik
[Kembali ke Halaman Token] (reset state)
```

#### 4.1 Progress Indicator / Stepper

Stepper ditampilkan di setiap langkah proses voting:

```
[●] Token  --  [○] Kandidat  --  [○] Konfirmasi  --  [○] Selesai
```

---

### 5. Fullscreen Enforcement

> ⚠️ **Catatan Kritis:** Fullscreen Enforcement adalah **UX deterrent**, **bukan security boundary**. Browser tidak dapat mengunci OS sepenuhnya. Mekanisme ini meningkatkan fokus siswa dan mencegah perilaku curang secara psikologis, tetapi tidak menjamin keamanan teknis secara mutlak. Pernyataan ini dicatat eksplisit di seluruh dokumen terkait.

#### 5.1 Mekanisme & Perilaku

| Aspek                             | Spesifikasi                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Kapan aktif**                   | Setelah token valid, sebelum menampilkan kandidat                                                         |
| **API Utama**                     | Fullscreen API: `document.documentElement.requestFullscreen()`                                            |
| **API Tambahan**                  | Keyboard Lock API: `navigator.keyboard.lock()` — dicoba setelah fullscreen aktif                          |
| **Jika keluar fullscreen**        | Voting **dijeda** (bukan dibatalkan) — overlay muncul, siswa diminta kembali fullscreen untuk melanjutkan |
| **Jika pindah tab**               | Sama: dijeda via Page Visibility API, overlay, lanjutkan dari langkah terakhir                            |
| **Jika browser kehilangan fokus** | Sama: dijeda via focus detection, overlay, lanjutkan dari langkah terakhir                                |

#### 5.2 Keyboard Lock API & Fallback Strategy

Aplikasi akan mencoba mengaktifkan **Keyboard Lock API** (`navigator.keyboard.lock()`) saat fullscreen aktif, untuk memblokir shortcut sistem seperti `Alt+Tab`, `Esc`, dan `Super/Win`. Namun, dukungan browser berbeda-beda.

**Urutan fallback jika Keyboard Lock API tidak tersedia:**

```
1. Fullscreen API         (wajib, selalu diaktifkan)
   |
2. Keyboard Lock API      (opsional, diaktifkan jika tersedia)
   |
3. Page Visibility API    (deteksi pindah tab / minimize)
   |
4. Focus Detection        (window blur / document visibilitychange)
```

Jika Keyboard Lock API tidak tersedia, sistem **tetap berfungsi** dengan fallback ke langkah 3 dan 4. Tidak ada error yang ditampilkan ke siswa.

#### 5.3 Browser Compatibility

Kompatibilitas browser terutama berpengaruh pada dukungan **Keyboard Lock API**. Fullscreen API dan Page Visibility API didukung oleh semua browser modern.

| Browser                   | Dukungan Fullscreen API | Dukungan Keyboard Lock API | Status                  |
| ------------------------- | :---------------------: | :------------------------: | ----------------------- |
| Google Chrome (Chromium)  |           ✅            |             ✅             | **Recommended**         |
| Microsoft Edge (Chromium) |           ✅            |             ✅             | Supported               |
| Firefox                   |           ✅            |             ❌             | Experimental            |
| Safari                    |       ⚠️ Terbatas       |             ❌             | Limited / Not Supported |

> **Rekomendasi deployment:** Gunakan **Google Chrome** atau **Microsoft Edge** di komputer voting untuk pengalaman terbaik. Panitia disarankan menginformasikan hal ini sebelum hari-H.

---

### 6. Election State Machine

```
SETUP --> READY --> OPEN --> PAUSED --> CLOSED --> ARCHIVED
                    ^           |
                    |           |
                    +-----------+
                   (OPEN <-> PAUSED)
```

| State      | Deskripsi                                         | Aksi yang Diizinkan                                  |
| ---------- | ------------------------------------------------- | ---------------------------------------------------- |
| `SETUP`    | Konfigurasi awal: tambah kandidat, generate token | Edit kandidat, generate token                        |
| `READY`    | Siap dibuka, konfigurasi terkunci                 | Preview, buka election                               |
| `OPEN`     | Voting sedang berlangsung                         | Pause, close                                         |
| `PAUSED`   | Voting ditangguhkan sementara                     | Resume (-> OPEN), close                              |
| `CLOSED`   | Voting selesai, tidak bisa dibuka lagi            | Archive                                              |
| `ARCHIVED` | Data tersimpan permanen, read-only                | (Tidak ada; hanya SUPER_ADMIN yang bisa hard-delete) |

> **Transisi satu arah:** Transisi state hanya bisa maju (tidak bisa mundur), kecuali `OPEN <-> PAUSED`. Ini mencegah manipulasi data historis.

---

### 7. Anti-Fraud & Integritas Data

#### 7.1 Integritas Vote (v1)

Integritas vote di v1 dijamin melalui kombinasi:

- **Transaksi atomik:** Penandaan token sebagai `used` dan insert record vote dilakukan dalam satu transaksi database yang tidak dapat dipisah. Jika salah satu gagal, keduanya di-rollback.
- **Append-only audit log:** Setiap aksi admin dan event voting dicatat secara permanen; tidak dapat diedit atau dihapus.
- **Database constraints:** Unique constraint pada token hash, foreign key integrity, dan check constraint pada state machine election.
- **Konsistensi transaksional:** Prisma digunakan untuk memastikan semua operasi kritis berjalan dalam transaksi eksplisit.

#### 7.2 Anonimitas Desain

- Penandaan "token telah dipakai" dan proses "insert vote" berada dalam **satu transaksi database atomik**.
- Tabel token dan tabel vote **tidak saling mereferensi secara langsung** (tidak ada foreign key `token_id` di tabel `votes`).
- Korelasi antara token/identitas dan kandidat secara teknis tidak dapat dilakukan dari dalam
  database. Pada mode berbobot, tabel vote hanya menyimpan role kelompok anonim untuk agregasi.

#### 7.3 Audit Log

Setiap aksi admin **selalu** menghasilkan satu record audit log, tanpa pengecualian.

**Sifat Audit Log:**

- **Append-only:** Record baru hanya bisa ditambahkan, tidak pernah diperbarui.
- **Immutable dari UI:** Tidak ada fitur edit atau hapus audit log yang tersedia melalui antarmuka admin maupun API.
- **Export diizinkan** sesuai permission matrix role (SUPER_ADMIN, ADMIN, VIEWER boleh export).

**Struktur record:**

| Field         | Deskripsi                                                      |
| ------------- | -------------------------------------------------------------- |
| `actor_id`    | ID admin yang melakukan aksi                                   |
| `action`      | Nama aksi (e.g., `ELECTION_OPENED`, `TOKEN_GENERATED`)         |
| `target_type` | Tipe objek yang menjadi target (e.g., `election`, `candidate`) |
| `target_id`   | ID objek target                                                |
| `timestamp`   | Waktu aksi (UTC)                                               |
| `ip_address`  | IP address actor                                               |
| `user_agent`  | User agent browser actor                                       |
| `result`      | `SUCCESS` atau `FAILURE`                                       |
| `metadata`    | Data tambahan dalam JSON (e.g., jumlah token yang di-generate) |

---

### 8. Realtime Dashboard

| Fitur                            | Spesifikasi                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status election                  | Tampil live (state machine)                                                                                                                                             |
| Total suara masuk                | Angka real-time                                                                                                                                                         |
| Jumlah & persentase per kandidat | Per kandidat, diperbarui berkala                                                                                                                                        |
| Tingkat partisipasi              | `(total votes / total tokens) * 100%`                                                                                                                                   |
| Grafik realtime                  | Bar chart atau pie chart                                                                                                                                                |
| Waktu vote terakhir              | Timestamp vote terakhir yang masuk                                                                                                                                      |
| **Throttle update**              | Update dashboard **di-throttle** (interval minimal N detik, TBD di arsitektur) — bukan per-vote instan — untuk mencegah inferensi pola voting saat jumlah pemilih kecil |
| **Live Dashboard mode**          | Toggle dari admin dashboard yang sama (bukan URL/halaman terpisah), untuk ditampilkan di proyektor/layar aula. Mode ini read-only dan menyembunyikan kontrol admin.     |

---

### 9. Keamanan Aplikasi

#### 9.1 Arsitektur Autentikasi Admin

Autentikasi admin menggunakan alur berikut:

```
Auth.js (NextAuth)
  --> Credentials Provider
  --> Argon2id password hashing
  --> Secure HTTP-only Session Cookie
  --> Role-Based Access Control (RBAC)
  --> Next.js Proxy (formerly Middleware)
```

**Pemisahan dua domain autentikasi:**

| Aspek          | Siswa                                        | Admin / Panitia                       |
| -------------- | -------------------------------------------- | ------------------------------------- |
| Metode         | Token anonim sekali pakai                    | Akun dengan username & password       |
| Sesi           | Tidak ada sesi persisten                     | HTTP-only session cookie              |
| Identitas      | Tidak ada; anonim by design                  | Terikat ke akun admin                 |
| Ketergantungan | Sepenuhnya independen dari autentikasi admin | Sepenuhnya independen dari alur siswa |

> Kedua domain autentikasi ini **tidak saling bergantung** secara teknis maupun desain. Tidak ada jalur yang menghubungkan session admin dengan token siswa.

#### 9.2 Kontrol Keamanan Aplikasi

| Kategori          | Mekanisme                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Autentikasi admin | NextAuth (Auth.js), Credentials Provider, session via HTTP-only + Secure + SameSite=Lax cookie                                    |
| Hash password     | Argon2id (bukan bcrypt — lebih tahan terhadap GPU/ASIC cracking)                                                                  |
| Hash token siswa  | HMAC-SHA256(token, SERVER_SECRET) — keyed hash mencegah verifikasi token bocor tanpa akses ke secret                              |
| SQL Injection     | Prisma parameterized queries (ORM tidak pernah mengirim raw query dari input user)                                                |
| XSS               | React escaping otomatis; tidak ada `dangerouslySetInnerHTML`                                                                      |
| CSRF              | NextAuth built-in CSRF token; SameSite cookie                                                                                     |
| Security headers  | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy                                                               |
| HTTPS             | Enforced di production; redirect HTTP -> HTTPS                                                                                    |
| Rate limiting     | Endpoint verifikasi token: mencegah brute force. Login admin: lockout setelah N kali gagal berturut-turut.                        |
| Secret management | Semua secret hanya via environment variable; **service role key tidak pernah dikirim ke browser**                                 |
| Route protection  | Middleware Next.js: `/vote` = token only, `/admin/*` = login wajib, `/admin/settings` = SUPER_ADMIN only. Gagal akses -> HTTP 403 |

---

### 10. Out of Scope — v1

Item-item berikut **secara eksplisit tidak termasuk** dalam v1 dan tidak boleh diimplementasikan tanpa revisi PRD:

- Mobile app native (iOS / Android)
- Face recognition / fingerprint biometrics
- Multi-election (lebih dari 1 election aktif sekaligus)
- Multi-school (satu sistem untuk banyak sekolah)
- Notifikasi email / SMS
- Blockchain voting
- AI recommendation
- QR code login siswa

---

## Design Decisions

| Keputusan                          | Pilihan                                    | Alasan                                                                                                    |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Voting tanpa akun siswa            | Token anonim                               | Mengurangi friction pendaftaran; sekolah tidak perlu menyimpan data pribadi siswa di sistem               |
| Hash password admin                | Argon2id                                   | Lebih memory-hard dibanding bcrypt, lebih tahan terhadap serangan GPU/ASIC modern                         |
| Hash token siswa                   | HMAC-SHA256 + SERVER_SECRET                | Keyed hash lebih aman dari SHA-256 polos; token yang bocor dari DB tidak bisa diverifikasi tanpa secret   |
| Anonimitas via desain tabel        | No direct FK token -> vote                 | Pendekatan privacy-by-design; tidak bisa di-bypass bahkan oleh admin dengan akses DB langsung             |
| Integritas v1 via transaksi atomik | Atomic transaction + append-only audit log | Hash Chain terlalu kompleks untuk v1; transaksi atomik + audit log sudah cukup untuk konteks sekolah      |
| Throttle dashboard                 | Ya, interval N detik                       | Mencegah inferensi pola voting real-time saat jumlah pemilih kecil                                        |
| State machine election             | 6 state, satu arah                         | Mencegah manipulasi data historis; audit trail yang jelas                                                 |
| Fullscreen sebagai UX deterrent    | Ya, dengan Keyboard Lock API + fallbacks   | Meningkatkan fokus siswa tanpa klaim keamanan palsu; fallback strategy memastikan degradasi yang graceful |
| Satu election aktif                | Ya (v1)                                    | Menyederhanakan arsitektur dan keamanan; multi-election di v2                                             |

---

## Future Improvements — v2

Item-item berikut adalah kandidat fitur v2. **Tidak boleh diimplementasikan di v1** tanpa update PRD yang disetujui.

| Fitur                                                        | Prioritas Estimasi |
| ------------------------------------------------------------ | ------------------ |
| **Hash Chain** untuk verifikasi integritas kriptografis vote | Tinggi             |
| QR code token (cetak & scan)                                 | Tinggi             |
| Multi-election support                                       | Tinggi             |
| Export PDF & Excel                                           | Sedang             |
| Public result page (URL publik pasca tutup)                  | Sedang             |
| Live TV mode (fullscreen projection view)                    | Sedang             |
| Multi-device dashboard                                       | Sedang             |
| Dark mode                                                    | Rendah             |

---

## Glossary

| Term                  | Definisi                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Token**             | String unik yang dibagikan ke siswa sebagai identitas voting anonim. Disimpan sebagai HMAC-SHA256 hash di DB.                                      |
| **Election**          | Satu sesi pemilihan Ketua OSIS, memiliki state machine dan satu set kandidat.                                                                      |
| **Hash Chain**        | Rantai hash kriptografis antar vote (kandidat v2). Dicatat di Future Improvements.                                                                 |
| **HMAC-SHA256**       | Keyed hash function yang menggunakan SERVER_SECRET sebagai kunci; lebih aman dari SHA-256 polos untuk penyimpanan token.                           |
| **Deterrent**         | Mekanisme yang mencegah perilaku tertentu secara psikologis/UX, bukan secara teknis mutlak.                                                        |
| **RBAC**              | Role-Based Access Control — sistem hak akses berbasis role.                                                                                        |
| **Audit Log**         | Rekam jejak setiap aksi admin; append-only, tidak dapat diedit atau dihapus dari UI.                                                               |
| **Throttle**          | Pembatasan frekuensi pembaruan data untuk mencegah inferensi pola.                                                                                 |
| **Keyboard Lock API** | Browser API (`navigator.keyboard.lock()`) untuk memblokir shortcut sistem saat fullscreen. Didukung Chrome/Edge; tidak tersedia di Firefox/Safari. |
| **OSIS**              | Organisasi Siswa Intra Sekolah — organisasi siswa resmi di sekolah Indonesia.                                                                      |

---

> **Catatan Revisi:** Dokumen ini hanya boleh diubah melalui review bersama tim (Product Manager, Architect, Security Engineer) dengan persetujuan eksplisit. Setiap perubahan harus mencantumkan tanggal, versi baru, dan ringkasan perubahan di bagian atas dokumen.
