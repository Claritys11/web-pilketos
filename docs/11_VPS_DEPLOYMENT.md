# 11 — VPS Deployment Guide

> **Audience:** Admin server / operator deployment
> **Target:** VPS Linux dengan Docker Compose
> **Last Updated:** 2026-08-04

---

## Requirement VPS

Minimum untuk pemilihan kecil sampai sekitar 1500 pemilih:

| Resource | Minimum                                                    | Direkomendasikan |
| -------- | ---------------------------------------------------------- | ---------------- |
| CPU      | 1 vCPU                                                     | 2 vCPU           |
| RAM      | 1 GB                                                       | 2 GB atau lebih  |
| Disk     | 10 GB                                                      | 20 GB SSD        |
| OS       | Ubuntu 24.04 LTS, Debian 12, atau distro Linux modern lain |

Software yang dibutuhkan:

- Docker Engine.
- Docker Compose plugin.
- Git.
- OpenSSL untuk membuat secret.
- Reverse proxy atau tunnel publik, misalnya Cloudflare Tunnel, nginx, Traefik, atau Coolify.
- Akun SMTP jika ingin token otomatis dikirim ke email siswa.

Port default aplikasi:

| Service    | Host default | Container |
| ---------- | ------------ | --------- |
| App        | `6500`       | `6500`    |
| PostgreSQL | `5434`       | `5432`    |

Untuk production, PostgreSQL tidak perlu dibuka ke publik. Biarkan hanya app/reverse proxy/tunnel
yang bisa diakses publik.

---

## Setup Pertama

Clone repo:

```bash
git clone https://github.com/Claritys11/web-pilketos.git
cd web-pilketos
```

Buat `.env` production:

```bash
cp .env.example .env
```

Generate secret:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Isi `.env` minimal:

```env
APP_PORT=6500
POSTGRES_PORT=5434
POSTGRES_USER=postgres
POSTGRES_PASSWORD=isi_password_database_yang_kuat
POSTGRES_DB=pilketos
APP_UID=1000
APP_GID=1000
DOCKER_SUBNET=172.31.50.0/24
DOCKER_GATEWAY=172.31.50.1

DATABASE_URL=postgresql://postgres:isi_password_database_yang_kuat@postgres:5432/pilketos
DIRECT_URL=postgresql://postgres:isi_password_database_yang_kuat@postgres:5432/pilketos

AUTH_SECRET=hasil_openssl_rand_base64_32
TOKEN_HMAC_SECRET=hasil_openssl_rand_hex_32
NEXTAUTH_URL=https://domain-pilketos.example
NEXT_PUBLIC_APP_URL=https://domain-pilketos.example

SUPABASE_URL=https://xyzabcdef.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder
SUPABASE_SERVICE_ROLE_KEY=local-placeholder
STORAGE_DRIVER=local
APP_VERSION=0.1.0

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=akun_smtp
SMTP_PASSWORD=password_smtp
SMTP_FROM="Pilketos <noreply@example.com>"
```

Alternatif Gmail API + Google Sheets/Drive OAuth:

```bash
npm run gmail:auth -- ./client_secret_xxx.apps.googleusercontent.com.json
```

Lalu isi:

```env
EMAIL_DRIVER=gmail_api
GMAIL_CLIENT_ID=isi_dari_output_script
GMAIL_CLIENT_SECRET=isi_dari_output_script
GMAIL_REFRESH_TOKEN=isi_dari_output_script
GMAIL_REDIRECT_URI=http://localhost:6500/api/gmail-oauth/callback
GMAIL_FROM="Pilketos <alamat-gmail-yang-dipakai-login@gmail.com>"
GMAIL_SECONDARY_CLIENT_ID=
GMAIL_SECONDARY_CLIENT_SECRET=
GMAIL_SECONDARY_REFRESH_TOKEN=
GMAIL_SECONDARY_FROM=
TOKEN_EMAIL_SENDS_PER_MINUTE=50
```

`TOKEN_EMAIL_SENDS_PER_MINUTE` membatasi pengiriman token agar provider email tidak mudah kena
limit. Default 50 email/menit, batas valid maksimum 100 email/menit.

Opsional Google Sheets sync:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_SHEET_NAME=Pilketos
```

Catatan penting:

- `TOKEN_HMAC_SECRET` harus dibuat sekali dan dipertahankan selama token lama masih dipakai.
- Mengubah `TOKEN_HMAC_SECRET` membuat token lama invalid.
- `NEXTAUTH_URL` dan `NEXT_PUBLIC_APP_URL` harus sama dengan domain publik production.
- Jika memakai Cloudflare Tunnel ke host lokal, arahkan tunnel ke `http://localhost:6500`.
- Untuk mode per pemilih, gunakan email provider. Plaintext token tidak ditampilkan/download di
  dashboard admin.
- Untuk Google Sheets, aktifkan Gmail API, Google Sheets API, dan Google Drive API. Jalankan ulang
  `npm run gmail:auth -- ./client_secret_xxx.apps.googleusercontent.com.json`, karena refresh token
  harus memiliki scope Gmail + Sheets + Drive.
- Jika `GOOGLE_SHEETS_SPREADSHEET_ID` kosong, aplikasi membuat spreadsheet baru per election di
  Drive akun OAuth tersebut. Jika diisi, aplikasi memakai satu spreadsheet manual dan membuat tab
  per election. Spreadsheet hanya menerima metadata pemilih dan status sudah/belum voting, bukan
  pilihan kandidat.

---

## Deploy Dengan Docker Compose

Jalankan:

```bash
docker compose up -d --build
```

Compose akan menjalankan urutan:

```text
postgres -> migrate -> seed -> app
```

Cek status:

```bash
docker compose ps
docker compose logs -f app
```

Cek health:

```bash
curl -i http://localhost:6500/api/health
```

Default bootstrap admin:

```text
username: superadmin
password: PilketosAdmin123
```

Segera ganti password atau buat Super Admin baru setelah login pertama.

---

## Update Versi

Untuk mengambil update dari GitHub dan redeploy:

```bash
git pull
docker compose up -d --build
```

Jangan gunakan `docker compose down -v` kecuali memang ingin menghapus database. Data penting ada
di volume:

```text
pilketos_pgdata
public/uploads
```

---

## Backup

Backup database:

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > pilketos-backup.sql
```

Backup upload kandidat:

```bash
tar -czf pilketos-uploads.tar.gz public/uploads
```

Restore database sebaiknya dilakukan saat aplikasi tidak sedang dipakai voting.

---

## Operasi Token Siswa

1. Login ke `/admin/login`.
2. Buat election dan kandidat.
3. Buka tab `Token`.
4. Klik `Generate Token`.
5. Pilih mode `Per Siswa`.
6. Download template CSV, lalu upload Excel/CSV atau paste daftar pemilih dengan format
   `ID, Nama, Kelas/Jabatan, Email, Tipe`.
7. Jika email aktif, sistem mengirim token ke email masing-masing pemilih secara bertahap sesuai
   `TOKEN_EMAIL_SENDS_PER_MINUTE`. Email berisi tombol ke `/vote?token=...` agar token otomatis
   terisi.
8. Jika ada email gagal, tekan `Retry Email Gagal`.
9. Pastikan semua token penting berstatus terkirim sebelum election dibuka.
10. Pantau tabel `Status Token Siswa` atau spreadsheet untuk melihat token sudah dipakai atau
    belum.

Sistem menyimpan metadata pemilih untuk distribusi dan status. Plaintext token tidak ditampilkan ke
admin; server hanya menyimpan ciphertext untuk kebutuhan retry email dan menghapusnya saat token
dipakai.

---

## Troubleshooting

Jika aplikasi tidak bisa dibuka:

- Cek `docker compose ps`.
- Cek `docker compose logs -f app`.
- Pastikan `APP_PORT` tidak bentrok.
- Pastikan reverse proxy/tunnel mengarah ke `http://localhost:6500`.

Jika token invalid:

- Pastikan election berstatus `OPEN`.
- Pastikan token belum dipakai.
- Pastikan `TOKEN_HMAC_SECRET` tidak berubah.
- Pastikan CSV yang dibagikan berasal dari election yang sedang dibuka.

Jika terjadi subnet collision Docker:

- Ubah `DOCKER_SUBNET` dan `DOCKER_GATEWAY` di `.env`.
- Jalankan ulang `docker compose up -d --build`.
- Jangan memakai `docker compose down -v` agar database tidak hilang.
