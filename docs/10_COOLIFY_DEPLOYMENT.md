# Coolify Deployment Guide

Gunakan guide ini saat deploy Pilketos dari GitHub ke Coolify.

## Compose File

Pakai file:

```text
docker-compose.coolify.yml
```

Compose ini dibuat khusus untuk Coolify:

- App mengekspos port container `6500` dan mem-publish-nya hanya ke
  `127.0.0.1:${APP_PORT:-6500}` untuk Cloudflare Tunnel lokal.
- PostgreSQL dan upload kandidat memakai named volume persisten.
- `migrate` dan `seed` berjalan sebagai one-off job sebelum app hidup.
- `migrate` dan `seed` memakai `exclude_from_hc: true` khusus Coolify.
- Tidak memakai custom network manual.

## Environment Variables

Wajib:

```env
POSTGRES_PASSWORD=isi_password_database_yang_kuat
AUTH_SECRET=hasil_openssl_rand_base64_32
TOKEN_HMAC_SECRET=hasil_openssl_rand_hex_32
SEED_ADMIN_PASSWORD=password_bootstrap_unik_minimal_12_karakter
SEED_ADMIN_RESET_EXISTING=false
NEXTAUTH_URL=https://domain-kamu.example
NEXT_PUBLIC_APP_URL=https://domain-kamu.example
```

Untuk deploymentmu, dua URL tersebut harus persis:

```env
NEXTAUTH_URL=https://pilketos.clarityz.my.id
NEXT_PUBLIC_APP_URL=https://pilketos.clarityz.my.id
```

Opsional:

```env
APP_PORT=6500
POSTGRES_USER=postgres
POSTGRES_DB=pilketos
STORAGE_DRIVER=local
APP_VERSION=0.1.0
```

Email Gmail API dan Google Sheets per election:

```env
EMAIL_DRIVER=gmail_api
GMAIL_CLIENT_ID=isi_dari_output_gmail_auth
GMAIL_CLIENT_SECRET=isi_dari_output_gmail_auth
GMAIL_REFRESH_TOKEN=refresh_token_dengan_scope_gmail_sheets_drive
GMAIL_REDIRECT_URI=https://pilketos.clarityz.my.id/api/gmail-oauth/callback
GMAIL_FROM="Pilketos <akun-google-pengirim@example.com>"
SUPPORT_WHATSAPP_NUMBER=62895337256234
TOKEN_EMAIL_SENDS_PER_MINUTE=50
TOKEN_EMAIL_BATCH_SIZE=20

GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_SHEET_NAME=Pilketos
```

Untuk Gmail API, pertahankan `TOKEN_EMAIL_SENDS_PER_MINUTE=50`. Aplikasi membatasi nilai maksimum
ke 60 agar sesuai dengan kuota per pengguna pada proyek Gmail API baru. Batas ini berbeda dari
batas pengiriman harian akun dan menaikkannya tidak membuat kuota harian bertambah.

Sebelum mengirim batch production, siapkan autentikasi domain dan cek deliverability sesuai
[`12_EMAIL_DELIVERABILITY.md`](12_EMAIL_DELIVERABILITY.md).

Refresh token harus dibuat dari script terbaru dan memiliki scope `gmail.send`, `spreadsheets`, dan
`drive.file`. Refresh token lama yang hanya memiliki `gmail.send` tetap dapat mengirim email, tetapi
tidak dapat membuat spreadsheet.

`SUPPORT_WHATSAPP_NUMBER` ditampilkan sebagai tombol bantuan pada email token. Gunakan format
internasional tanpa `+`; nomor Indonesia `0895337256234` menjadi `62895337256234`.

Generate secret:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Pakai output pertama untuk `AUTH_SECRET`, output kedua untuk `TOKEN_HMAC_SECRET`. Buat password
bootstrap berbeda untuk `SEED_ADMIN_PASSWORD`.
Jangan rotate `TOKEN_HMAC_SECRET` selama token voting lama masih dipakai.

## Persistent Storage

Volume yang harus dipertahankan:

```text
pilketos_pgdata   -> /var/lib/postgresql/data
pilketos_uploads  -> /app/public/uploads
```

`pilketos_pgdata` menyimpan database PostgreSQL.
`pilketos_uploads` menyimpan foto kandidat jika `STORAGE_DRIVER=local`.

## First Deploy

1. Push repo ke GitHub.
2. Buat resource baru di Coolify dari Git repository.
3. Pilih Docker Compose build pack.
4. Set compose file location ke `docker-compose.coolify.yml`.
5. Isi environment variables.
6. Set domain pada service `app` ke domain publik dan port container `6500`.
7. Deploy.
8. Buka `/api/health`.
9. Login ke `/admin/login`.

Jika domain app tidak dipakai dari Coolify, `docker-compose.coolify.yml` tetap mem-publish
`127.0.0.1:${APP_PORT:-6500}:6500`, sehingga Cloudflare Tunnel bisa diarahkan langsung ke:

```yaml
- hostname: pilketos.clarityz.my.id
  service: http://localhost:6500
```

Username bootstrap default:

```text
username: superadmin
```

Password login pertama adalah nilai `SEED_ADMIN_PASSWORD` di Coolify. Seeder tidak mereset akun
yang sudah ada kecuali `SEED_ADMIN_RESET_EXISTING=true`. Untuk pemulihan akun, aktifkan flag itu
selama satu deployment, pastikan login berhasil, lalu kembalikan ke `false` agar deploy berikutnya
tidak terus mengganti password.

## Voting Setup

1. Login sebagai Super Admin.
2. Buka `Elections`.
3. Buat election.
4. Tambah minimal dua kandidat.
5. Buka tab `Token`.
6. Generate token sesuai jumlah pemilih.
7. Pastikan email token berhasil atau gunakan `Retry Email Gagal`; plaintext token per pemilih tidak
   ditampilkan maupun diunduh dari dashboard.
8. Tandai election `READY`.
9. Saat pemilihan dimulai, ubah ke `OPEN`.
10. Siswa membuka `/vote`, memasukkan token, lalu memilih kandidat.
11. Setelah selesai, ubah election ke `CLOSED`.

Pengiriman email berjalan dalam batch pendek agar tidak terkena timeout Cloudflare/Coolify. Jika tab
ditutup atau jaringan putus, buka halaman token lalu tekan `Kirim Email Antre`; proses melanjutkan
baris yang masih pending tanpa membuat token baru.

## Troubleshooting

Jika token invalid:

- Pastikan election sudah `OPEN`.
- Pastikan token belum pernah dipakai.
- Pastikan `TOKEN_HMAC_SECRET` tidak berubah setelah token dibuat.
- Jika `TOKEN_HMAC_SECRET` pernah berubah, token lama tidak dapat dipulihkan dan harus dibuat ulang
  saat election masih `SETUP`.

Jika CSS tidak muncul:

- Pastikan membuka domain app, bukan file HTML lokal.
- Redeploy setelah perubahan kode.
- Cek `/_next/static/...css` menghasilkan `200 OK`.

Jika foto kandidat tidak muncul:

- Pastikan `STORAGE_DRIVER=local`.
- Pastikan volume `pilketos_uploads` masih ada.
- Cek file tersedia dari URL `/uploads/candidates/nama-file`.

Jika admin action gagal:

- Pastikan `NEXTAUTH_URL` sama dengan domain publik.
- Pastikan memakai HTTPS untuk domain production.
- Logout lalu login ulang setelah mengganti `NEXTAUTH_URL`.

Jika Google Spreadsheet tidak dibuat:

- Pastikan Gmail API, Google Sheets API, dan Google Drive API aktif pada project OAuth.
- Generate ulang refresh token memakai `npm run gmail:auth -- ./client_secret_xxx.json`.
- Pastikan consent mencantumkan Gmail, Sheets, dan Drive; refresh token lama tidak mendapat scope
  tambahan secara otomatis.
- Biarkan `GOOGLE_SHEETS_SPREADSHEET_ID` kosong untuk satu spreadsheet baru per election.
