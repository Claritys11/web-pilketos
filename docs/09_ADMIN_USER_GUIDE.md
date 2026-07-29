# 09 — Admin User Guide

> **Last Updated:** 2026-07-29
> **Audience:** Panitia Pilketos / Operator Admin

---

## Alamat Halaman

| Kebutuhan       | URL                |
| --------------- | ------------------ |
| Voting siswa    | `/vote`            |
| Login admin     | `/admin/login`     |
| Dashboard admin | `/admin/dashboard` |

`/vote` memang langsung membuka halaman voting untuk siswa. Admin panel selalu lewat `/admin/login`.

---

## Setup Awal Admin

Setelah deploy pertama dengan Docker Compose, akun bootstrap tersedia:

```text
username: superadmin
password: PilketosAdmin123
```

Segera lakukan salah satu dari dua pilihan ini:

1. Login sebagai `superadmin`, buka `Settings`, buat akun Super Admin baru, lalu nonaktifkan akun default.
2. Login sebagai `superadmin`, buka `Settings`, edit akun default dan ganti password.

---

## Membuat Election

1. Login ke `/admin/login`.
2. Buka menu `Elections`.
3. Klik `Tambah Election`.
4. Isi judul dan deskripsi.
5. Election baru selalu mulai dari status `SETUP`.

Status election:

| Status     | Arti                                             |
| ---------- | ------------------------------------------------ |
| `SETUP`    | Kandidat dan token masih bisa disiapkan.         |
| `READY`    | Data siap, tetapi siswa belum bisa voting.       |
| `OPEN`     | Voting sedang dibuka. Token siswa valid dipakai. |
| `PAUSED`   | Voting dijeda sementara.                         |
| `CLOSED`   | Voting selesai dan hasil terkunci.               |
| `ARCHIVED` | Election disimpan sebagai arsip.                 |

---

## Menambahkan Kandidat

1. Buka `Elections`.
2. Klik election yang akan digunakan.
3. Buka tab `Kandidat`.
4. Klik `Tambah Kandidat`.
5. Isi nomor urut, nama, kelas, visi, misi, dan foto.
6. Simpan.

Minimal 2 kandidat dibutuhkan sebelum election bisa masuk ke `READY`.

Foto kandidat:

- Format: JPG, PNG, atau WEBP.
- Maksimal 2MB.
- File divalidasi dari ekstensi, MIME type, dan magic bytes.

---

## Generate Token Voting

Token dibuat dari tab `Token` pada detail election.

1. Pastikan election masih `SETUP`.
2. Buka tab `Token`.
3. Klik `Generate Token`.
4. Masukkan jumlah token sesuai jumlah pemilih.
5. Klik `Generate`.
6. Sistem menampilkan token plaintext satu kali dan mengunduh CSV otomatis.
7. Simpan CSV di tempat aman.

Aturan penting:

- Satu token untuk satu siswa.
- Token plaintext tidak disimpan di database.
- Jika CSV hilang, token lama tidak bisa ditampilkan ulang.
- Token hanya bisa digunakan saat election berstatus `OPEN`.
- Token yang sudah digunakan tidak bisa dipakai lagi.

---

## Membuka Voting

1. Pastikan kandidat minimal 2 dan token minimal 1.
2. Dari detail election, klik `Tandai Siap`.
3. Saat jam voting dimulai, klik `Buka Voting`.
4. Siswa membuka `/vote`, memasukkan token, memilih kandidat, lalu konfirmasi suara.
5. Pantau suara masuk di `/admin/dashboard`.

---

## Menutup Voting

1. Dari detail election, klik `Tutup Voting`.
2. Setelah status `CLOSED`, siswa tidak bisa mengirim suara lagi.
3. Jika hasil sudah disahkan, klik `Arsipkan`.

---

## Role Admin

| Role          | Hak Akses                                            |
| ------------- | ---------------------------------------------------- |
| `SUPER_ADMIN` | Kelola semua fitur termasuk admin lain dan settings. |
| `ADMIN`       | Kelola election, kandidat, token, dan dashboard.     |
| `VIEWER`      | Hanya melihat data dan dashboard.                    |

---

## Troubleshooting Singkat

| Masalah                         | Cek                                             |
| ------------------------------- | ----------------------------------------------- |
| Siswa tidak bisa validasi token | Pastikan election berstatus `OPEN`.             |
| Tombol tambah kandidat hilang   | Kandidat hanya bisa diubah saat status `SETUP`. |
| Generate token gagal            | Token hanya bisa dibuat saat status `SETUP`.    |
| Healthcheck gagal               | Cek PostgreSQL dan storage lewat `/api/health`. |
| Admin tidak bisa akses settings | Settings hanya untuk `SUPER_ADMIN`.             |
