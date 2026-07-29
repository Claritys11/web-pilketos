# Coolify Deployment Guide

Gunakan guide ini saat deploy Pilketos dari GitHub ke Coolify.

## Compose File

Pakai file:

```text
docker-compose.coolify.yml
```

Compose ini dibuat khusus untuk Coolify:

- Tidak memakai host `ports` untuk app.
- App hanya `expose` port container `6500`.
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
NEXTAUTH_URL=https://domain-kamu.example
NEXT_PUBLIC_APP_URL=https://domain-kamu.example
```

Opsional:

```env
APP_PORT=6500
POSTGRES_USER=postgres
POSTGRES_DB=pilketos
STORAGE_DRIVER=local
APP_VERSION=0.1.0
```

Generate secret:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Pakai output pertama untuk `AUTH_SECRET`, output kedua untuk `TOKEN_HMAC_SECRET`.
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
`${APP_PORT:-6500}:6500`, sehingga Cloudflare Tunnel bisa diarahkan langsung ke:

```yaml
- hostname: pilketos.clarityz.my.id
  service: http://localhost:6500
```

Default seed admin:

```text
username: superadmin
password: PilketosAdmin123
```

Ganti password setelah login pertama.

## Voting Setup

1. Login sebagai Super Admin.
2. Buka `Elections`.
3. Buat election.
4. Tambah minimal dua kandidat.
5. Buka tab `Token`.
6. Generate token sesuai jumlah pemilih.
7. Simpan CSV karena plaintext token hanya tampil satu kali.
8. Tandai election `READY`.
9. Saat pemilihan dimulai, ubah ke `OPEN`.
10. Siswa membuka `/vote`, memasukkan token, lalu memilih kandidat.
11. Setelah selesai, ubah election ke `CLOSED`.

## Troubleshooting

Jika token invalid:

- Pastikan election sudah `OPEN`.
- Pastikan token belum pernah dipakai.
- Pastikan `TOKEN_HMAC_SECRET` tidak berubah setelah token dibuat.
- Generate batch token baru jika CSV lama hilang atau secret pernah berubah.

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
