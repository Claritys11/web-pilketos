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

Default seed admin:

```text
username: superadmin
password: PilketosAdmin123
```

Ganti password ini sebelum dipakai di lingkungan nyata.

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

- Jangan tambah host `ports` untuk service `app` kecuali memang ingin membuka port langsung dari host.
- Jangan tambah custom Docker network manual; biarkan Coolify mengelola network resource.
- Service `migrate` dan `seed` adalah job satu kali. Keduanya diberi `exclude_from_hc: true`.
- Jika domain publik memakai HTTPS, pastikan `NEXTAUTH_URL` dan `NEXT_PUBLIC_APP_URL` juga HTTPS.
- `TOKEN_HMAC_SECRET` harus dibuat sekali dan dipertahankan. Mengubahnya akan membuat token voting lama tidak valid.

Jika tidak memakai domain app dari Coolify dan ingin mengarahkan Cloudflare Tunnel langsung ke host,
`docker-compose.coolify.yml` sudah mem-publish `${APP_PORT:-6500}:6500`. Arahkan cloudflared ke:

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

Default seed admin:

```text
username: superadmin
password: PilketosAdmin123
```

Segera ganti password ini setelah login pertama.

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

Alur setup pemilihan:

1. Login ke `/admin/login` memakai akun Super Admin.
2. Buka `Elections`.
3. Buat election baru, atau gunakan election seed untuk percobaan.
4. Masuk ke detail election.
5. Buka tab `Kandidat`, tambah minimal 2 kandidat, isi nama, kelas, visi, misi, dan foto.
6. Buka tab `Token`.
7. Klik `Generate Token`, masukkan jumlah token sesuai jumlah pemilih. Satu batch mendukung sampai 2000 token.
8. Setelah generate sukses, sistem menampilkan plaintext token satu kali dan otomatis mengunduh CSV.
9. Simpan CSV itu dengan aman, lalu cetak/bagikan satu token untuk satu siswa.
10. Kembali ke detail election, klik `Tandai Siap`.
11. Saat voting dimulai, klik `Buka Voting`.
12. Siswa membuka `/vote`, memasukkan token, memilih kandidat, lalu mengirim suara.
13. Pantau hasil masuk di `/admin/dashboard`.
14. Setelah selesai, ubah status election ke `CLOSED`, lalu `ARCHIVED` jika hasil sudah disahkan.

Catatan token:

- Token plaintext hanya muncul satu kali setelah generate. Database hanya menyimpan hash HMAC.
- Jika CSV hilang, token lama tidak bisa ditampilkan ulang. Generate batch baru bila masih di status `SETUP`.
- Token hanya valid saat election berstatus `OPEN`.
- Satu token hanya bisa dipakai sekali.
- Jangan kirim token lewat channel publik.

## Production Deploy Dengan Docker

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
