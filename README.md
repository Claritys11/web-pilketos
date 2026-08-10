# Pilketos E-Voting

Sistem e-voting Pemilihan Ketua OSIS berbasis Next.js 16, Auth.js, Prisma, dan PostgreSQL.

## Status

Yang sudah berjalan:

- Database schema, migration, seed Super Admin, dan service layer inti.
- Auth admin berbasis Auth.js Credentials + JWT session.
- Route protection menggunakan `src/proxy.ts` karena Next.js 16 mengganti Middleware menjadi Proxy.
- API voting, admin CRUD, token generation/export, audit, dashboard stats, dan health check.
- UI siswa `/vote` sampai `/vote/done`.
- UI admin `/admin/login`, dashboard live, election/candidate/token/audit/settings.
- Token bisa dibuat sebagai batch biasa atau satu token per siswa dengan metadata NIS/ID, nama,
  kelas, email, status sudah/belum dipakai, dan status pengiriman email token.
- Security hardening: headers, rate limiter, upload signature validation, secure session cookie.
- Docker production image dengan standalone output.
- Docker Compose lokal dengan PostgreSQL di port `5434` dan app di port `6500`.
- Compose khusus Coolify di `docker-compose.coolify.yml`.

Yang belum final:

- Test otomatis formal masih belum dibuat.
- Load testing, UAT, dan setup production infra sekolah masih perlu dilakukan sebelum hari pemilihan.

## Prasyarat

- Node.js 22 direkomendasikan.
- npm.
- Docker dan Docker Compose untuk mode container.
- PostgreSQL lokal di port `5434`, atau gunakan `docker compose up postgres`.

## Environment

Copy file contoh:

```bash
cp .env.example .env.local
```

Untuk GitHub/public repo, commit `.env.example` saja. Jangan commit `.env`, `.env.local`,
`.env.production`, atau file upload kandidat.

Port lokal yang dipakai proyek ini:

- App: `http://localhost:6500`
- PostgreSQL host: `localhost:5434`
- PostgreSQL container internal: `postgres:5432`

Untuk development, Docker lokal, atau deploy lokal lewat Cloudflare Tunnel tanpa Supabase, gunakan:

```env
STORAGE_DRIVER=local
```

Dengan `STORAGE_DRIVER=local`, foto kandidat disimpan di folder `public/uploads` pada host
dan di-mount ke container sebagai `/app/public/uploads`.
Data election, kandidat, token, vote, admin, dan audit tetap disimpan di PostgreSQL lewat Prisma.

Dashboard admin yang terlihat live memakai polling API ke PostgreSQL. Fitur ini tidak membutuhkan
Supabase Realtime.

Supabase hanya dibutuhkan jika ingin memakai object storage eksternal untuk foto kandidat:

```env
STORAGE_DRIVER=supabase
```

Jika memakai Supabase Storage, isi `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan
`SUPABASE_SERVICE_ROLE_KEY` dengan kredensial asli.

Generate secret:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Gunakan hasilnya untuk `AUTH_SECRET` dan `TOKEN_HMAC_SECRET`.

Konfigurasi email token bersifat opsional. Untuk mode per pemilih, plaintext token tidak
ditampilkan atau diunduh dari dashboard; gunakan email agar token sampai langsung ke pemilih.

Pilih provider:

```env
EMAIL_DRIVER=smtp
```

atau:

```env
EMAIL_DRIVER=gmail_api
```

SMTP:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=akun_smtp
SMTP_PASSWORD=password_smtp
SMTP_FROM="Pilketos <noreply@example.com>"
```

Gmail API + Google Sheets/Drive OAuth:

```bash
npm run gmail:auth -- ./client_secret_xxx.apps.googleusercontent.com.json
```

Tambahkan output script ke `.env`/Coolify env:

```env
EMAIL_DRIVER=gmail_api
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_REDIRECT_URI=http://localhost:6500/api/gmail-oauth/callback
GMAIL_FROM="Pilketos <alamat-gmail-yang-dipakai-login@gmail.com>"
SUPPORT_WHATSAPP_NUMBER=62895337256234

# Opsional: credential kedua untuk fallback saat credential utama kena limit/provider error
GMAIL_SECONDARY_CLIENT_ID=
GMAIL_SECONDARY_CLIENT_SECRET=
GMAIL_SECONDARY_REFRESH_TOKEN=
GMAIL_SECONDARY_FROM=

# Default 50 email/menit; maksimum 60 untuk mengikuti kuota Gmail API per pengguna.
TOKEN_EMAIL_SENDS_PER_MINUTE=50

# Maksimal email per request pendek; 20 aman untuk proxy/tunnel umum.
TOKEN_EMAIL_BATCH_SIZE=20
```

Untuk Coolify pada domain proyek ini, gunakan
`GMAIL_REDIRECT_URI=https://pilketos.clarityz.my.id/api/gmail-oauth/callback` jika URI publik itu
yang didaftarkan di Google Cloud. Redirect URI harus sama persis. Refresh token untuk Sheets harus
dibuat ulang dengan scope Gmail, Sheets, dan Drive; menyalakan API saja tidak menambah scope pada
refresh token lama.

Email token berisi tombol voting ke `/vote?token=...`, sehingga token otomatis terisi di halaman
voting dan pemilih tinggal menekan lanjut. Jika `SUPPORT_WHATSAPP_NUMBER` diisi, email juga
menampilkan tombol WhatsApp untuk melaporkan link atau website yang bermasalah.

Untuk menyiapkan custom-domain sender, SPF, DKIM, DMARC, kuota Gmail, dan pemeriksaan Spam, ikuti
[`docs/12_EMAIL_DELIVERABILITY.md`](docs/12_EMAIL_DELIVERABILITY.md). Nilai 50 email/menit sudah
direkomendasikan untuk Gmail API; menaikkannya tidak menambah batas pengiriman harian akun.

Opsional Google Sheets sync untuk kontrol sudah/belum voting:

1. Aktifkan Gmail API, Google Sheets API, dan Google Drive API di Google Cloud project yang sama.
2. Jalankan `npm run gmail:auth -- ./client_secret_xxx.apps.googleusercontent.com.json` ulang,
   karena refresh token harus punya scope Gmail + Sheets + Drive.
3. Isi env berikut di `.env`/Coolify:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_SHEET_NAME=Pilketos
```

Sheets hanya menyimpan metadata pemilih dan status token/email. Pilihan kandidat tetap anonim dan
tidak dikirim ke spreadsheet.

Jika `GOOGLE_SHEETS_SPREADSHEET_ID` kosong, sistem otomatis membuat spreadsheet baru per election
di Drive akun OAuth tersebut. Jika `GOOGLE_SHEETS_SPREADSHEET_ID` diisi, sistem memakai satu
spreadsheet manual dan membuat tab/sheet baru per election.

Status sync, pesan error, tombol sinkron ulang, dan link langsung ke file tersedia pada halaman
detail election. Generate token tetap berhasil bila Google sedang bermasalah, tetapi kegagalan sync
akan terlihat oleh admin dan dapat dicoba ulang tanpa membuat baris token duplikat.

Jika ingin memisahkan OAuth email dan Sheets, isi `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, dan `GOOGLE_OAUTH_REFRESH_TOKEN`. Jika kosong, Sheets otomatis memakai
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, dan `GMAIL_REFRESH_TOKEN`.

## Development Lokal

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Generate Prisma client, migrate, dan seed:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Start app:

```bash
npm run dev
```

Buka:

```text
http://localhost:6500/vote
```

Halaman penting:

```text
Voting siswa: http://localhost:6500/vote
Login admin:  http://localhost:6500/admin/login
Dashboard:    http://localhost:6500/admin/dashboard
```

Default seed admin untuk development lokal:

```text
username: superadmin
password: PilketosAdmin123
```

Production wajib mengisi `SEED_ADMIN_PASSWORD` sendiri; jangan memakai password development ini.

## Verifikasi

Jalankan sebelum commit/deploy:

```bash
npm run type-check
npm run lint
npm run build
```

Smoke test cepat:

```bash
curl -i http://localhost:6500/api/health
curl -i http://localhost:6500/api/admin/elections
curl -i -X POST http://localhost:6500/api/vote/validate-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"INVALID12345"}'
```

Ekspektasi:

- `/api/health` mengembalikan `200` jika DB dan storage OK.
- `/api/admin/elections` tanpa login mengembalikan `401`.
- Token invalid mengembalikan error JSON standar.

## Docker Lokal

Untuk Docker Compose, buat file `.env` di root project. Compose otomatis membaca `.env`
saat menjalankan `docker compose up -d --build`.

Contoh `.env` Docker lokal:

```env
APP_PORT=6501
POSTGRES_PORT=5434
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=pilketos
APP_UID=1000
APP_GID=1000
SEED_ADMIN_USERNAME=superadmin
SEED_ADMIN_EMAIL=superadmin@pilketos.local
SEED_ADMIN_PASSWORD=password_bootstrap_unik_minimal_12_karakter
SEED_ADMIN_RESET_EXISTING=false
DOCKER_SUBNET=172.31.50.0/24
DOCKER_GATEWAY=172.31.50.1

DATABASE_URL=postgresql://postgres:password@postgres:5432/pilketos
DIRECT_URL=postgresql://postgres:password@postgres:5432/pilketos

AUTH_SECRET=isi_dengan_openssl_rand_base64_32
TOKEN_HMAC_SECRET=isi_dengan_openssl_rand_hex_32
NEXTAUTH_URL=http://localhost:6501
NEXT_PUBLIC_APP_URL=http://localhost:6501

SUPABASE_URL=https://xyzabcdef.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder
SUPABASE_SERVICE_ROLE_KEY=local-placeholder
STORAGE_DRIVER=local
APP_VERSION=0.1.0

EMAIL_DRIVER=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=http://localhost:6500/api/gmail-oauth/callback
GMAIL_FROM=
SUPPORT_WHATSAPP_NUMBER=
```

Penting: `TOKEN_HMAC_SECRET` harus tetap sama selama token voting yang sudah dibuat
masih akan dipakai. Kalau secret ini berubah, semua token lama akan menjadi invalid.

Build dan jalankan app + PostgreSQL + migrasi + bootstrap seed:

```bash
docker compose up -d --build
```

Compose akan otomatis menjalankan urutan ini:

```text
postgres -> migrate -> seed -> app
```

Seeder aman dijalankan berulang. Jika akun `superadmin` sudah ada, password tidak akan di-reset.

Lihat status:

```bash
docker compose ps
docker compose logs -f app
```

App tersedia di:

```text
Voting siswa: http://localhost:6500/vote
Admin panel:  http://localhost:6500/admin/login
```

Jika port `6500` sedang dipakai:

```bash
APP_PORT=6501 \
NEXTAUTH_URL=http://localhost:6501 \
NEXT_PUBLIC_APP_URL=http://localhost:6501 \
docker compose up -d --build
```

Lalu buka:

```text
Voting siswa: http://localhost:6501/vote
Admin panel:  http://localhost:6501/admin/login
```

Jika Chrome menampilkan HTML polos tanpa styling:

- Pastikan membuka URL server, bukan file HTML lokal: `http://localhost:6500/vote` atau port override seperti `http://localhost:6501/vote`.
- Setelah update kode, jalankan ulang `docker compose up -d --build` agar asset Next di image ikut terganti.
- Hard refresh Chrome dengan `Ctrl+Shift+R`, atau buka Incognito untuk menghindari cache asset lama.
- Cek asset CSS tersedia:

```bash
CSS_PATH=$(curl -s http://localhost:6500/vote | grep -o '/_next/static/chunks/[^"]*\.css' | head -1)
curl -I "http://localhost:6500${CSS_PATH}"
```

Respons yang benar adalah `200 OK` dengan `Content-Type: text/css`.

Jika terjadi Docker subnet collision dengan project lain, ubah subnet Pilketos di `.env`:

```env
DOCKER_SUBNET=172.31.50.0/24
DOCKER_GATEWAY=172.31.50.1
```

Lalu recreate hanya project Pilketos tanpa menghapus volume database:

```bash
docker compose down
docker compose up -d --build
```

Jangan gunakan `docker compose down -v` kecuali memang ingin menghapus data PostgreSQL.

## Deploy Di Coolify

File yang dipakai untuk Coolify:

```text
docker-compose.coolify.yml
```

Alur yang direkomendasikan:

1. Push repository ke GitHub.
2. Di Coolify, buat resource baru dari Git repository.
3. Pilih build pack Docker Compose.
4. Set Docker Compose file location ke `docker-compose.coolify.yml`.
5. Set domain pada service `app` dan arahkan ke port container `6500`.
6. Isi environment variables di Coolify.
7. Deploy.

Environment wajib untuk Coolify:

```env
POSTGRES_PASSWORD=isi_password_database_yang_kuat
AUTH_SECRET=hasil_openssl_rand_base64_32
TOKEN_HMAC_SECRET=hasil_openssl_rand_hex_32
SEED_ADMIN_PASSWORD=password_bootstrap_unik_minimal_12_karakter
NEXTAUTH_URL=https://domain-kamu.example
NEXT_PUBLIC_APP_URL=https://domain-kamu.example
```

Environment opsional:

```env
APP_PORT=6500
POSTGRES_USER=postgres
POSTGRES_DB=pilketos
STORAGE_DRIVER=local
APP_VERSION=0.1.0
```

Untuk local storage, `SUPABASE_*` boleh memakai placeholder default dari compose. Foto kandidat
akan disimpan di volume `pilketos_uploads`, sedangkan database disimpan di volume
`pilketos_pgdata`. Backup dua volume ini sebelum upgrade atau migrasi server.

Catatan penting Coolify:

- Port app dipublish hanya ke `127.0.0.1:${APP_PORT:-6500}` agar Cloudflare Tunnel bisa mengaksesnya
  tanpa membuka port mentah ke interface publik.
- Jangan tambah custom Docker network manual; biarkan Coolify mengelola network resource.
- Service `migrate` dan `seed` adalah job satu kali. Keduanya diberi `exclude_from_hc: true`.
- Jika domain publik memakai HTTPS, pastikan `NEXTAUTH_URL` dan `NEXT_PUBLIC_APP_URL` juga HTTPS.
- `TOKEN_HMAC_SECRET` harus dibuat sekali dan dipertahankan. Mengubahnya akan membuat token voting lama tidak valid.

Jika tidak memakai domain app dari Coolify dan ingin mengarahkan Cloudflare Tunnel langsung ke host,
`docker-compose.coolify.yml` sudah mem-publish `127.0.0.1:${APP_PORT:-6500}:6500`. Arahkan
cloudflared ke:

```yaml
- hostname: pilketos.clarityz.my.id
  service: http://localhost:6500
```

Setelah deploy, buka:

```text
Voting siswa: https://domain-kamu.example/vote
Admin panel:  https://domain-kamu.example/admin/login
Healthcheck:  https://domain-kamu.example/api/health
```

Username bootstrap default:

```text
username: superadmin
```

Password login pertama adalah nilai `SEED_ADMIN_PASSWORD` yang kamu isi di Coolify. Seeder tidak
mereset password jika akun tersebut sudah ada. Untuk pemulihan, set
`SEED_ADMIN_RESET_EXISTING=true` selama satu deployment, lalu kembalikan ke `false` setelah login
berhasil.

## Simulasi Publik Dengan Cloudflare Tunnel

Pastikan app Compose sudah healthy:

```bash
docker compose ps
curl http://localhost:6501/api/health
```

Jalankan quick tunnel:

```bash
cloudflared tunnel --protocol http2 --url http://localhost:6501
```

Gunakan `--protocol http2` jika jaringan lokal memblokir QUIC/UDP port `7844`.
Cloudflared akan menampilkan URL seperti:

```text
https://nama-random.trycloudflare.com
```

Setelah URL muncul, ubah `.env`:

```env
NEXTAUTH_URL=https://nama-random.trycloudflare.com
NEXT_PUBLIC_APP_URL=https://nama-random.trycloudflare.com
```

Lalu recreate app agar Auth.js dan public URL memakai domain publik:

```bash
docker compose up -d
```

Buka:

```text
Voting siswa: https://nama-random.trycloudflare.com/vote
Admin panel:  https://nama-random.trycloudflare.com/admin/login
```

Quick tunnel bersifat sementara. Jika proses `cloudflared` berhenti, URL itu mati.
Untuk acara nyata, gunakan named tunnel Cloudflare agar URL stabil.

Stop:

```bash
docker compose down
```

Hapus data lokal:

```bash
docker compose down -v
```

Setelah `down -v`, data database hilang. Saat `docker compose up -d --build` berikutnya,
seed akan membuat ulang akun awal:

```text
username: superadmin
password: PilketosAdmin123
```

Segera ganti password atau buat Super Admin baru sebelum dipakai nyata.

## Alur Admin Dan Token Voting

Admin panel ada di:

```text
http://localhost:6500/admin/login
```

`/vote` sengaja langsung membuka halaman voting siswa. Itu bukan dashboard admin.

Panduan panitia yang lebih lengkap ada di
[`docs/09_ADMIN_USER_GUIDE.md`](docs/09_ADMIN_USER_GUIDE.md).
Panduan deployment VPS ada di [`docs/11_VPS_DEPLOYMENT.md`](docs/11_VPS_DEPLOYMENT.md).
Panduan deliverability email ada di
[`docs/12_EMAIL_DELIVERABILITY.md`](docs/12_EMAIL_DELIVERABILITY.md).

Alur setup pemilihan:

1. Login ke `/admin/login` memakai akun Super Admin.
2. Buka `Elections`.
3. Buat election baru dan pilih mode `Kandidat bebas` atau `5 kandidat berbobot`.
4. Masuk ke detail election.
5. Buka tab `Kandidat`. Mode biasa membutuhkan minimal 2 kandidat; mode berbobot wajib tepat 5.
6. Buka tab `Token`.
7. Klik `Generate Token`.
8. Untuk distribusi rapi, gunakan mode `Per Siswa`, download template CSV, lalu upload Excel/CSV
   atau paste daftar sesuai template mode election.
9. Setelah generate sukses, sistem mengirim token lewat email secara bertahap sesuai
   `TOKEN_EMAIL_SENDS_PER_MINUTE` dalam request batch pendek. Jika browser atau jaringan terputus,
   gunakan `Kirim Email Antre` untuk melanjutkan dari token yang belum dikirim. Plaintext token
   tidak ditampilkan dan tidak diunduh dari dashboard.
10. Jika ada email gagal, gunakan tombol `Retry Email Gagal`; server akan mengirim ulang dari token
    terenkripsi tanpa mengekspos plaintext ke admin.
11. Jika status sudah `Terkirim` tetapi pemilih tidak menerima email, gunakan tombol `Resend` pada
    baris pemilih. Sistem mengirim token yang sama tanpa membuat token baru.
12. Pastikan email pemilih valid sebelum election dibuka.
13. Pantau tabel `Status Token Pemilih` atau Google Sheets untuk melihat siapa yang belum voting dan
    status email token.
14. Kembali ke detail election, klik `Tandai Siap`.
15. Saat voting dimulai, klik `Buka Voting`.
16. Siswa membuka `/vote`, memasukkan token, memilih kandidat, lalu mengirim suara.
17. Pantau hasil masuk di `/admin/dashboard`.
18. Setelah selesai, ubah status election ke `CLOSED`, lalu `ARCHIVED` jika hasil sudah disahkan.

Catatan token:

- Database menyimpan hash HMAC untuk validasi token dan ciphertext token khusus untuk retry email
  server-side. Plaintext token tidak ditampilkan/download di admin.
- Untuk mode per siswa/guru, database menyimpan metadata pemilih dan `used_at`, tetapi tidak
  menyimpan kandidat yang dipilih oleh pemilih tersebut.
- Email siswa disimpan untuk distribusi dan pengecekan status. `email_sent_at` dan `email_error`
  membantu operator melihat token mana yang terkirim atau gagal dikirim.
- Jika Google Sheets sync aktif, kolom status token akan berubah dari `BELUM_VOTING` ke
  `SUDAH_VOTING` setelah pemilih mengirim suara.
- Jika email gagal, retry dari dashboard selama token belum dipakai dan ciphertext masih tersedia.
- Token hanya valid saat election berstatus `OPEN`.
- Satu token hanya bisa dipakai sekali.
- Jangan kirim token lewat channel publik.

Mode `5 kandidat berbobot` tidak memakai NIS/ID. Import wajib berisi nama, email, dan role
`OSIS`/`MPK`/`GURU`; kelas wajib untuk OSIS dan MPK, sedangkan kelas GURU dikosongkan dan diabaikan.
Election baru bisa ditandai `READY` setelah ketiga role memiliki token.
Skor akhir kandidat adalah `(persentase suara OSIS x 40%) + (persentase suara MPK x 30%) +
(persentase suara GURU x 30%)`. Vote hanya menyimpan role kelompok untuk agregasi, bukan identitas,
email, atau token pemilih.

## Production Deploy Dengan Docker

Panduan lengkap requirement VPS, firewall, env production, backup, dan operasi harian ada di
[`docs/11_VPS_DEPLOYMENT.md`](docs/11_VPS_DEPLOYMENT.md).

Untuk deployment sederhana di VPS dengan Compose, isi env production di `docker-compose.yml`
atau gunakan file override Compose milik server, lalu jalankan:

```bash
docker compose up -d --build
```

Perintah itu sudah membangun image, menjalankan migrasi, menjalankan seed bootstrap yang aman,
dan menyalakan app. Untuk melihat status:

```bash
docker compose ps
docker compose logs -f app
```

Jika ingin mode image manual tanpa Compose, build image:

```bash
docker build -t pilketos:latest .
```

Jalankan app:

```bash
docker run -d \
  --name pilketos \
  --env-file .env.production \
  -p 6500:6500 \
  pilketos:latest
```

Pastikan production env memakai:

```env
NODE_ENV=production
NEXTAUTH_URL=https://domain-sekolah.example
NEXT_PUBLIC_APP_URL=https://domain-sekolah.example
STORAGE_DRIVER=local
```

Untuk deploy lokal satu mesin, `STORAGE_DRIVER=local` cukup dan tidak membutuhkan Supabase.
Jika ingin memakai Supabase Storage, ubah `STORAGE_DRIVER=supabase`, buat bucket Supabase Storage
bernama `candidate-photos`, lalu jalankan policy read-only publik dari
[`docs/supabase-storage-policy.sql`](docs/supabase-storage-policy.sql).

## Production Deploy Tanpa Docker

Install dependency dan build:

```bash
npm ci
npm run db:generate
npm run build
```

Deploy migrasi:

```bash
npm run db:deploy
```

Jalankan standalone server. Pastikan environment sudah diekspor oleh process manager:

```bash
PORT=6500 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Jika menjalankan manual dari shell lokal:

```bash
set -a
. ./.env.local
set +a
PORT=6500 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

## Catatan Operasional

- Jangan set `SKIP_ENV_VALIDATION=1` saat runtime. Flag itu hanya untuk build Docker.
- Jangan commit `.env.local` atau `.env.production`.
- `TOKEN_HMAC_SECRET` tidak boleh diganti setelah token voting dibuat, karena semua token lama akan invalid.
- Healthcheck production akan gagal jika PostgreSQL atau storage driver yang dipilih tidak sehat.
- Untuk local development, `STORAGE_DRIVER=local` membuat foto kandidat disimpan di `public/uploads`.
- URL `/_next/image?...` adalah cache/optimizer Next.js. File asli upload tetap berada di `public/uploads`.
