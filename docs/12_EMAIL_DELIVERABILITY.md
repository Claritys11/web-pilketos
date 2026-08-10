# Email Deliverability Guide

Panduan ini membantu email token Pilketos lebih konsisten diterima. Tidak ada konfigurasi yang
dapat menjamin semua email masuk Inbox karena keputusan akhir tetap dibuat oleh provider penerima.

## Audit `clarityz.my.id`

Hasil pemeriksaan DNS publik pada 10 Agustus 2026:

- MX root domain mengarah ke Cloudflare Email Routing.
- SPF sudah ada untuk Cloudflare, MailerSend, dan Mailjet.
- DMARC belum dipublikasikan.
- DKIM Google belum terlihat pada selector umum yang diperiksa.
- Subdomain web `pilketos.clarityz.my.id` tidak perlu memiliki MX sendiri selama alamat pengirim
  memakai `@clarityz.my.id`.

DNS domain hanya membantu jika header `From` benar-benar memakai alamat pada domain tersebut.
Email yang dikirim sebagai akun sekolah atau `@gmail.com` mengikuti autentikasi dan reputasi domain
akun itu, bukan `clarityz.my.id`.

## Opsi A: Google Workspace

Gunakan opsi ini jika ingin Gmail API mengirim langsung sebagai `pilketos@clarityz.my.id` dan
membutuhkan hingga sekitar 1.200 email dalam satu hari.

1. Aktifkan Google Workspace berbayar untuk `clarityz.my.id` dan buat mailbox
   `pilketos@clarityz.my.id`.
2. Rencanakan migrasi email masuk. MX root saat ini milik Cloudflare Email Routing; menggantinya
   dengan MX Google akan mengubah jalur email masuk. Jangan menghapus MX Cloudflare sebelum mailbox
   dan alamat penerima di Google siap.
3. Di Google Admin Console, buat DKIM 2048-bit lalu publikasikan nama dan nilai TXT persis seperti
   yang diberikan Google. Setelah DNS terdeteksi, aktifkan autentikasi DKIM.
4. Pertahankan hanya satu record SPF. Masukkan semua layanan yang masih benar-benar mengirim email.
   Contoh selama Google, Cloudflare, MailerSend, dan Mailjet semuanya masih aktif:

   ```text
   v=spf1 include:_spf.google.com include:_spf.mx.cloudflare.net include:_spf.mailersend.net include:spf.mailjet.com ~all
   ```

   Hapus provider yang sudah tidak digunakan. Jangan membuat record SPF kedua.

5. Mulai DMARC dalam mode observasi:

   ```text
   Host: _dmarc
   Value: v=DMARC1; p=none; pct=100
   ```

   Tambahkan `rua=mailto:dmarc@clarityz.my.id` hanya setelah alamat tersebut dapat menerima laporan.
   Setelah SPF/DKIM stabil dan laporan bersih, naikkan bertahap ke `p=quarantine`, lalu `p=reject`.

6. Buat ulang OAuth refresh token sambil login sebagai mailbox Workspace pengirim. Pastikan scope
   Gmail, Sheets, dan Drive tetap disetujui jika sinkronisasi spreadsheet dipakai.
7. Atur env Coolify:

   ```env
   EMAIL_DRIVER=gmail_api
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   GMAIL_REDIRECT_URI=https://pilketos.clarityz.my.id/api/gmail-oauth/callback
   GMAIL_FROM="Pilketos <pilketos@clarityz.my.id>"
   TOKEN_EMAIL_SENDS_PER_MINUTE=50
   TOKEN_EMAIL_BATCH_SIZE=20
   ```

8. Kirim batch uji kecil. Di Gmail penerima, buka **Show original** dan pastikan SPF, DKIM, serta
   DMARC semuanya `PASS` dan domainnya selaras dengan header `From`.

Alamat pada `GMAIL_FROM` harus merupakan mailbox yang login atau alias **Send mail as** yang sudah
diverifikasi pada akun tersebut. Mengganti teks `From` saja tidak membuat domain terautentikasi.

## Opsi B: Transactional SMTP

Gunakan opsi ini jika ingin mempertahankan Cloudflare Email Routing untuk email masuk. Verifikasi
`clarityz.my.id` pada provider SMTP, publikasikan DKIM dan return-path yang diberikan provider, lalu
gunakan:

```env
EMAIL_DRIVER=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="Pilketos <pilketos@clarityz.my.id>"
TOKEN_EMAIL_SENDS_PER_MINUTE=50
```

Free tier provider umum tidak cukup untuk 1.200 email per hari. Gunakan paket yang kuota bulanannya
mencakup jumlah election, dan jangan mencampur banyak provider tanpa memastikan semuanya tercantum
di SPF serta memakai DKIM yang valid.

## Kuota Dan Kecepatan

| Pengirim                  | Batas yang relevan                                                  |
| ------------------------- | ------------------------------------------------------------------- |
| Gmail pribadi             | Sekitar 500 email atau penerima per hari                            |
| Google Workspace berbayar | Hingga 2.000 pesan per pengguna per hari                            |
| Google Workspace trial    | Hingga 500 pesan per hari                                           |
| Gmail API proyek baru     | 6.000 quota units/pengguna/menit; `messages.send` memakai 100 units |
| Pilketos                  | Default 50 dan maksimum 60 email/menit                              |

Batas API dan batas harian adalah dua hal berbeda. Gmail API secara efektif mengizinkan 60 operasi
send per pengguna per menit pada model kuota baru, tetapi tidak menaikkan kuota harian mailbox.
Dengan 50 email/menit, 1.200 email membutuhkan minimal sekitar 24 menit.

## Checklist Sebelum Election

1. Bersihkan typo dan alamat tidak aktif dari file import untuk menjaga bounce rate rendah.
2. Pastikan SPF, DKIM, dan DMARC `PASS` pada beberapa provider penerima.
3. Gunakan nama dan alamat pengirim yang konsisten.
4. Mulai dari batch uji kecil sebelum mengirim ke seluruh pemilih.
5. Pertahankan `TOKEN_EMAIL_SENDS_PER_MINUTE=50`; gunakan fitur retry hanya untuk baris gagal.
6. Minta admin Google Workspace sekolah mengizinkan alamat/domain pengirim jika mayoritas penerima
   memakai domain sekolah.
7. Pantau reputasi domain melalui Google Postmaster Tools dan jaga spam rate di bawah 0,3%.

## Referensi Resmi

- [Gmail sender guidelines](https://support.google.com/mail/answer/81126)
- [Gmail API quota usage](https://developers.google.com/workspace/gmail/api/reference/quota)
- [Google Workspace sending limits](https://support.google.com/a/answer/166852)
- [Personal Gmail sending limits](https://support.google.com/mail/answer/22839)
- [Set up MX records for Google Workspace](https://support.google.com/a/answer/6156494)
- [Set up SPF](https://support.google.com/a/answer/33786)
- [Set up DKIM](https://support.google.com/a/answer/180504)
- [Set up DMARC](https://support.google.com/a/answer/2466580)
