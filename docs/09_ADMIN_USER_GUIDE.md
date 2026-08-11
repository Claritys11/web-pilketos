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
password: nilai SEED_ADMIN_PASSWORD saat deployment
```

Segera lakukan salah satu dari dua pilihan ini:

1. Login sebagai `superadmin`, buka `Settings`, buat akun Super Admin baru, lalu nonaktifkan akun default.
2. Login sebagai `superadmin`, buka `Settings`, edit akun default dan ganti password.

---

## Membuat Election

1. Login ke `/admin/login`.
2. Buka menu `Elections`.
3. Klik `Tambah Election`.
4. Isi judul, deskripsi, dan pilih mode election:
   - `Kandidat bebas`: minimal 2 kandidat dan hasil berdasarkan jumlah suara biasa.
   - `5 kandidat berbobot`: tepat 5 kandidat dengan bobot OSIS 40%, MPK 30%, dan GURU 30%.
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

Mode biasa membutuhkan minimal 2 kandidat. Mode berbobot harus memiliki tepat 5 kandidat sebelum
election bisa masuk ke `READY`.

Foto kandidat:

- Format: JPG, PNG, atau WEBP.
- Maksimal 5MB.
- File divalidasi dari ekstensi, MIME type, dan magic bytes.

---

## Generate Token Voting

Token dibuat dari tab `Token` pada detail election.

1. Pastikan election masih `SETUP`.
2. Buka tab `Token`.
3. Klik `Generate Token`.
4. Pilih mode `Per Siswa`, download template CSV, lalu upload Excel/CSV atau paste daftar pemilih.
5. Klik `Generate`.
6. Sistem mengirim token ke email pemilih secara bertahap sesuai batas server. Email berisi tombol
   voting yang membuka `/vote?token=...`, jadi token otomatis terisi.
   Jika nomor dukungan dikonfigurasi, email juga menyediakan tombol WhatsApp untuk melaporkan link
   atau website voting yang bermasalah tanpa menyertakan token dalam pesan awal.
7. Jika browser/jaringan terputus, gunakan `Kirim Email Antre` untuk melanjutkan token pending.
8. Jika provider menolak email, gunakan `Retry Email Gagal`; retry membuka token terenkripsi di
   server tanpa menampilkan plaintext kepada admin.
9. Jika pemilih tidak menemukan email meskipun statusnya `Terkirim`, klik `Resend` pada baris
   pemilih dan konfirmasi. Sistem mengirim token yang sama dan tidak membuat token baru. Resend tidak
   tersedia setelah token dipakai atau election ditutup.
10. Sebelum membuka voting, kembali ke ringkasan election dan sesuaikan subjek/pesan email token
    serta reminder jika diperlukan. Gunakan `{{name}}` dan `{{election}}` untuk personalisasi, lalu
    periksa preview lengkap. Jadwal pembukaan dapat ditulis langsung pada pesan pembuka; token,
    tombol, link fallback, peringatan, dan kontak support tetap ditambahkan sistem.
11. Saat election diubah ke `OPEN`, sistem otomatis mengirim reminder kepada pemilih yang email
    token awalnya sudah terkirim dan belum voting. Pantau status antre/terkirim/gagal di ringkasan
    atau tabel token; gunakan `Lanjutkan Antrean` setelah restart dan `Retry Reminder Gagal` untuk
    mencoba ulang kegagalan provider.

Mode `Per Siswa` direkomendasikan untuk pemilihan nyata dan bisa berisi siswa maupun guru.
Dashboard admin menyimpan metadata pemilih, status email, dan status token dipakai, tetapi tidak
menampilkan plaintext token.

Format daftar pemilih:

```text
12345,Nama Siswa 1,XII RPL 1,siswa1@example.com,SISWA
G001,Nama Guru 1,Guru,guru1@example.com,GURU
```

Untuk mode 5 kandidat berbobot, download template khusus mode tersebut. NIS/ID tidak digunakan:

```text
Nama Pengurus OSIS,XII RPL 1,osis@example.com,OSIS
Nama Pengurus MPK,XI TKJ 1,mpk@example.com,MPK
Nama Guru,,guru@example.com,GURU
```

Nama, email, dan role wajib. Kelas wajib untuk OSIS/MPK, sedangkan kelas GURU boleh kosong dan akan
diabaikan. Mode berbobot tidak menyediakan generate berdasarkan jumlah karena setiap token harus
memiliki role agar hasil dapat dihitung. Ketiga role harus memiliki minimal satu token sebelum
election dapat ditandai `READY`.

Header Excel/CSV yang dikenali: `student_identifier`/`nis`/`id`, `student_name`/`nama`,
`student_class`/`kelas`/`jabatan`, `student_email`/`email`, dan `voter_type`/`role`/`tipe`.
Mode berbobot juga menerima CSV tanpa header dengan urutan `nama,kelas,email,role`, termasuk file
`pilketos_voters_formatted.csv`. Field yang mengandung koma harus mengikuti aturan CSV dan dibungkus
tanda kutip ganda. Pemisah manual boleh koma, titik koma, atau tab. ID tidak boleh duplikat dalam satu election.
Email bersifat opsional per baris, tetapi token hanya dikirim otomatis untuk pemilih yang punya email.
Jika Google Sheets sync aktif, metadata pemilih, status email, dan status sudah/belum voting juga
masuk ke spreadsheet. Pilihan kandidat tidak pernah dikirim ke spreadsheet.

Di halaman detail election terdapat panel `Google Spreadsheet`. Panel ini menampilkan waktu sync,
error terakhir, tombol `Sinkronkan Sekarang`, dan tombol `Buka Spreadsheet`. Sinkron ulang mengganti
data token election secara utuh sehingga tidak membuat baris ganda.

## Mengecek Status Token Pemilih

Di tab `Token`, tabel `Status Token Pemilih` menampilkan:

- NIS/ID siswa.
- Nama siswa.
- Kelas.
- Tipe pemilih `Siswa` atau `Guru`.
- Email siswa.
- Status `Belum dipakai` atau `Sudah dipakai`.
- Status email token `Belum`, `Terkirim`, atau `Gagal`.
- Waktu token dipakai.

Gunakan pencarian untuk menemukan siswa tertentu. Tombol `Refresh` memuat ulang status terbaru.
`Export Metadata` mengunduh CSV metadata dan status token, bukan plaintext token.

Aturan penting:

- Satu token untuk satu siswa.
- Token plaintext tidak disimpan di database.
- Sistem menyimpan metadata siswa untuk distribusi dan pengecekan status token.
- Sistem menyimpan email siswa untuk pengiriman token dan pengecekan siapa yang belum voting.
- Sistem tidak menyimpan relasi token ke kandidat yang dipilih.
- Token gagal kirim bisa di-retry dari server selama belum dipakai.
- Token hanya bisa digunakan saat election berstatus `OPEN`.
- Token yang sudah digunakan tidak bisa dipakai lagi.

---

## Membuka Voting

1. Pastikan kandidat minimal 2 untuk mode biasa atau tepat 5 untuk mode berbobot, serta token minimal 1.
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

## Mengelola Admin dan Password

1. Buka `Settings` menggunakan akun `SUPER_ADMIN`.
2. Klik `Tambah Admin`, isi username dan email unik, pilih role, lalu masukkan password beserta konfirmasinya.
3. Untuk mengganti password akun lain, klik `Edit` pada akun tersebut dan isi password baru.
4. Untuk mengganti password akun yang sedang dipakai, klik `Ganti Password Saya` dan masukkan password saat ini.
5. Password harus berisi 8-128 karakter serta memiliki huruf kecil, huruf besar, dan angka.

Perubahan password akun sendiri dicatat sebagai `ADMIN_PASSWORD_CHANGED` tanpa menyimpan password ke audit log.

---

## Troubleshooting Singkat

| Masalah                         | Cek                                             |
| ------------------------------- | ----------------------------------------------- |
| Siswa tidak bisa validasi token | Pastikan election berstatus `OPEN`.             |
| Tombol tambah kandidat hilang   | Kandidat hanya bisa diubah saat status `SETUP`. |
| Generate token gagal            | Token hanya bisa dibuat saat status `SETUP`.    |
| Healthcheck gagal               | Cek PostgreSQL dan storage lewat `/api/health`. |
| Admin tidak bisa akses settings | Settings hanya untuk `SUPER_ADMIN`.             |
