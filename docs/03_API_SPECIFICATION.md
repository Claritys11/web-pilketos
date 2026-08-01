# 03 — API Specification

> **Status:** DRAFT — Pending Review
> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Authors:** Senior Software Architect · Backend Engineer
> **PRD Reference:** `00_PRODUCT_REQUIREMENTS_DOCUMENT.md` v1.1.0
> **DB Reference:** `01_DATABASE_DESIGN.md` v1.0.0
> **Arch Reference:** `02_SYSTEM_ARCHITECTURE.md` v1.1.0
> **Scope:** Full API contract — v1
> **Audience:** Backend Engineer · Frontend Engineer · QA Engineer

---

## Purpose

Dokumen ini mendefinisikan **seluruh kontrak API** sistem Pilketos. Setiap endpoint, request, response, validation rule, business rule, dan behavior dijelaskan secara lengkap.

Dokumen ini adalah **API Contract** — bukan panduan implementasi. Tidak ada kode Next.js, Prisma, atau TypeScript di sini. Frontend dan backend engineer harus dapat membaca dokumen ini dan membangun sistem yang compatible satu sama lain.

Setiap endpoint berasal dari PRD dan System Architecture. Tidak ada endpoint yang diperkenalkan di luar scope yang sudah disepakati.

---

## API Design Principles

### REST Conventions

- Resource-based URL: `/api/admin/elections`, bukan `/api/getElections`.
- HTTP method merefleksikan aksi: `GET` (read), `POST` (create), `PATCH` (partial update), `DELETE` (delete).
- URL menggunakan `kebab-case`: `/api/admin/voting-tokens`.
- Parameter path menggunakan `[id]` dalam kurung kotak.
- Tidak ada verb dalam URL: `/api/admin/elections/[id]/status` (bukan `/api/admin/changeElectionStatus`).

### Format

- Semua request dan response menggunakan **JSON** (`Content-Type: application/json`).
- Pengecualian: `/api/admin/tokens/export` mengembalikan CSV, `/api/admin/candidates/[id]/photo` menerima `multipart/form-data`.
- Semua timestamp dalam **ISO 8601 UTC**: `"2026-07-27T15:30:00.000Z"`.
- Semua ID menggunakan **CUID**: `"clxxx..."`.

### Versioning Strategy

- v1 tidak menggunakan prefix versi di URL (`/api/v1/...`) — semua endpoint langsung di `/api/`.
- Versi API dimuat dalam response header: `X-API-Version: 1.0.0`.
- Jika v2 dibutuhkan, prefix akan ditambahkan: `/api/v2/...`.

### Naming Conventions

| Elemen             | Konvensi               | Contoh                                |
| ------------------ | ---------------------- | ------------------------------------- |
| URL path segment   | `kebab-case`           | `/validate-token`, `/audit-log`       |
| Request body field | `camelCase`            | `candidateId`, `electionId`           |
| Response field     | `camelCase`            | `createdAt`, `orderNumber`            |
| Enum value di body | `SCREAMING_SNAKE_CASE` | `"SETUP"`, `"SUPER_ADMIN"`            |
| Query parameter    | `camelCase`            | `?page=1&pageSize=20&filterBy=action` |

### Response Format — Success

```json
{
  "success": true,
  "data": { ... }
}
```

Untuk list response:

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Response Format — Error

```json
{
  "success": false,
  "error": {
    "code": "ELECTION_NOT_OPEN",
    "message": "Voting sedang tidak berlangsung.",
    "details": null
  }
}
```

Validation error dengan detail per field:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": {
      "candidateId": "Required",
      "token": "Token harus berupa string 12-32 karakter"
    }
  }
}
```

### Pagination

Default untuk semua list endpoint yang menggunakan pagination:

| Parameter  | Default | Max   | Deskripsi                 |
| ---------- | ------- | ----- | ------------------------- |
| `page`     | `1`     | —     | Nomor halaman (1-indexed) |
| `pageSize` | `20`    | `100` | Jumlah item per halaman   |

### Sorting

Format: `?sortBy=createdAt&sortOrder=desc`

| Parameter   | Default     | Nilai valid                      |
| ----------- | ----------- | -------------------------------- |
| `sortBy`    | `createdAt` | Kolom yang didukung per endpoint |
| `sortOrder` | `desc`      | `asc`, `desc`                    |

### Filtering

Format: `?filterBy[field]=value`

Contoh: `?filterBy[action]=ELECTION_OPENED&filterBy[result]=FAILURE`

---

## Authentication

### Admin Authentication

Admin menggunakan session berbasis cookie yang dikelola oleh Auth.js (NextAuth).

- Login via `POST /api/auth/signin`.
- Session disimpan dalam **HTTP-only + Secure + SameSite=Lax cookie** (`next-auth.session-token`).
- Cookie dikirim otomatis oleh browser pada setiap request ke domain yang sama.
- Semua endpoint admin (`/api/admin/*`) memvalidasi session ini.
- Role admin tersimpan dalam session JWT dan diverifikasi per-request.

### Student Authentication (Token-based, Stateless)

Siswa tidak memiliki akun atau session. Autentikasi bersifat **stateless berbasis token**:

- Token plaintext disubmit dalam request body.
- Server melakukan HMAC-SHA256 verification setiap request.
- Tidak ada cookie, tidak ada server-side session untuk siswa.
- Token hanya valid jika: (1) hash cocok di database, (2) `used_at` masih `null`, (3) election berstatus `OPEN`.
- Token di-re-validasi pada setiap operasi — tidak ada trust dari request sebelumnya.

---

## Global Headers

### Request Headers (Semua Endpoint)

| Header         | Required             | Deskripsi                                          |
| -------------- | -------------------- | -------------------------------------------------- |
| `Content-Type` | Ya (jika ada body)   | `application/json`                                 |
| `Accept`       | Opsional             | `application/json`                                 |
| `Cookie`       | Ya (admin endpoints) | Session cookie NextAuth — dikirim otomatis browser |

### Response Headers (Semua Endpoint)

| Header                  | Deskripsi                                    |
| ----------------------- | -------------------------------------------- |
| `Content-Type`          | `application/json; charset=utf-8`            |
| `X-API-Version`         | `1.0.0`                                      |
| `X-RateLimit-Limit`     | Batas request per window (jika rate limited) |
| `X-RateLimit-Remaining` | Sisa request dalam window saat ini           |
| `X-RateLimit-Reset`     | Unix timestamp saat window reset             |

### Security Headers (Injected via Middleware)

| Header                      | Value                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                      |
| `X-Frame-Options`           | `DENY`                                                     |
| `X-Content-Type-Options`    | `nosniff`                                                  |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                          |
| `Content-Security-Policy`   | Lihat `02_SYSTEM_ARCHITECTURE.md §Middleware Architecture` |

---

## Common Error Codes

| Code                           | HTTP Status | Deskripsi                                                |
| ------------------------------ | ----------- | -------------------------------------------------------- |
| `VALIDATION_ERROR`             | 400         | Input gagal validasi schema                              |
| `TOKEN_INVALID`                | 400         | Token tidak ditemukan di database                        |
| `TOKEN_ALREADY_USED`           | 409         | Token sudah dipakai sebelumnya                           |
| `ELECTION_NOT_OPEN`            | 422         | Election tidak dalam state OPEN saat vote                |
| `ELECTION_NOT_FOUND`           | 404         | Election ID tidak ditemukan                              |
| `CANDIDATE_NOT_FOUND`          | 404         | Candidate ID tidak ditemukan                             |
| `CANDIDATE_NOT_IN_ELECTION`    | 422         | Candidate tidak termasuk dalam election yang aktif       |
| `ELECTION_WRONG_STATE`         | 422         | Operasi tidak valid untuk state election saat ini        |
| `ELECTION_TRANSITION_INVALID`  | 422         | Transisi state machine tidak diizinkan                   |
| `ELECTION_MIN_CANDIDATES`      | 422         | Election harus memiliki minimal 2 kandidat               |
| `ELECTION_MAX_CANDIDATES`      | 422         | Election sudah memiliki 5 kandidat (maksimum)            |
| `CANDIDATE_HAS_VOTES`          | 409         | Kandidat tidak dapat dihapus karena sudah memiliki suara |
| `ORDER_NUMBER_TAKEN`           | 409         | Nomor urut sudah digunakan kandidat lain                 |
| `UNAUTHORIZED`                 | 401         | Tidak terautentikasi                                     |
| `FORBIDDEN`                    | 403         | Role tidak memiliki akses                                |
| `NOT_FOUND`                    | 404         | Resource tidak ditemukan                                 |
| `CONFLICT`                     | 409         | Konflik dengan state saat ini                            |
| `RATE_LIMIT_EXCEEDED`          | 429         | Terlalu banyak request                                   |
| `INTERNAL_ERROR`               | 500         | Server error internal                                    |
| `SERVICE_UNAVAILABLE`          | 503         | Layanan tidak tersedia (health check gagal)              |
| `ADMIN_USERNAME_TAKEN`         | 409         | Username admin sudah digunakan                           |
| `ADMIN_EMAIL_TAKEN`            | 409         | Email admin sudah digunakan                              |
| `ADMIN_NOT_FOUND`              | 404         | Admin ID tidak ditemukan                                 |
| `CANNOT_DEACTIVATE_SELF`       | 422         | Admin tidak dapat menonaktifkan diri sendiri             |
| `ACTIVE_ELECTION_EXISTS`       | 422         | Sudah ada election aktif (OPEN/PAUSED)                   |
| `TOKEN_GENERATION_ACTIVE_ONLY` | 422         | Token hanya bisa di-generate saat state SETUP            |
| `PHOTO_UPLOAD_FAILED`          | 500         | Gagal upload foto ke storage                             |
| `INVALID_FILE_TYPE`            | 400         | Tipe file foto tidak didukung                            |
| `FILE_TOO_LARGE`               | 400         | Ukuran file foto melebihi batas                          |

---

## Endpoint Categories

| Kategori         | Base Path               | Jumlah Endpoint | Auth                        |
| ---------------- | ----------------------- | --------------- | --------------------------- |
| Voting           | `/api/vote`             | 2               | Token-based                 |
| Authentication   | `/api/auth`             | 3               | N/A (NextAuth)              |
| Election         | `/api/admin/elections`  | 4               | Admin session               |
| Candidate        | `/api/admin/candidates` | 4               | Admin session               |
| Token            | `/api/admin/tokens`     | 2               | Admin session               |
| Dashboard        | `/api/admin/dashboard`  | 1               | Admin session               |
| Audit            | `/api/admin/audit`      | 1               | Admin session               |
| Admin Management | `/api/admin/admins`     | 2               | Admin session (SUPER_ADMIN) |
| Health           | `/api/health`           | 1               | None (public)               |

---

## Rate Limiting Strategy

### Global Rate Limit

Semua endpoint dikenakan rate limit default: **60 requests / menit / IP**.

### Endpoint-Specific Rate Limits

| Endpoint                          | Limit      | Window        | Rationale                                              |
| --------------------------------- | ---------- | ------------- | ------------------------------------------------------ |
| `POST /api/vote/validate-token`   | **10 req** | 1 menit / IP  | Mencegah brute force token _(PRD §9.2)_                |
| `POST /api/auth/signin`           | **5 req**  | 15 menit / IP | Mencegah credential brute force + lockout _(PRD §9.2)_ |
| `POST /api/admin/tokens/generate` | **5 req**  | 5 menit / IP  | Operasi berat, prevent abuse                           |
| `POST /api/vote/cast`             | **3 req**  | 5 menit / IP  | Mencegah race condition spam                           |

### Rate Limit Response

```json
HTTP 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Terlalu banyak permintaan. Coba lagi dalam beberapa saat.",
    "details": {
      "retryAfter": 60
    }
  }
}
```

Headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1722090120
Retry-After: 60
```

---

## Pagination Standard

Semua list endpoint menggunakan offset-based pagination.

### Request

```
GET /api/admin/audit?page=2&pageSize=50
```

### Response Shape

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 2,
      "pageSize": 50,
      "total": 347,
      "totalPages": 7,
      "hasNextPage": true,
      "hasPrevPage": true
    }
  }
}
```

### Validation

- `page`: integer, min 1, default 1.
- `pageSize`: integer, min 1, max 100, default 20.
- `page` melebihi `totalPages`: kembalikan `items: []` (bukan error).

---

## Filtering Standard

Filtering menggunakan query parameter dengan format flat `filterBy[field]=value`.

Contoh:

```
GET /api/admin/audit?filterBy[action]=ELECTION_OPENED&filterBy[result]=FAILURE
GET /api/admin/elections?filterBy[status]=OPEN
```

- Nilai enum dalam filter harus cocok persis (case-sensitive).
- Beberapa filter bisa dikombinasikan (AND logic).
- Field yang tidak didukung untuk filter diabaikan (bukan error).

---

## Voting API

---

### V-01 — Validate Token

**`POST /api/vote/validate-token`**

**Purpose:** Memvalidasi token siswa sebelum voting dimulai. Memeriksa keberadaan token di database (via HMAC hash), status penggunaan, dan status election.

**Authentication:** None (public endpoint).

**Authorization:** N/A.

**Rate Limiting:** 10 request / menit / IP. _(PRD §9.2)_

---

**Request Headers:**

| Header         | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request Body:**

| Field   | Type     | Required | Deskripsi                                        |
| ------- | -------- | -------- | ------------------------------------------------ |
| `token` | `string` | Yes      | Token plaintext yang diterima siswa dari panitia |

**Validation Rules:**

| Field   | Rule                                                                              |
| ------- | --------------------------------------------------------------------------------- |
| `token` | Required; string; min length 8; max length 64; tidak boleh berupa whitespace saja |

---

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "electionId": "clxxx...",
    "electionTitle": "Pilketos 2025/2026"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code            | Kondisi                                                            |
| ----------- | --------------------- | ------------------------------------------------------------------ |
| 400         | `VALIDATION_ERROR`    | Token field kosong atau format tidak valid                         |
| 400         | `TOKEN_INVALID`       | Token tidak ditemukan (hash tidak cocok) atau `used_at` tidak null |
| 422         | `ELECTION_NOT_OPEN`   | Election yang terkait tidak dalam state `OPEN`                     |
| 429         | `RATE_LIMIT_EXCEEDED` | Terlalu banyak percobaan dari IP ini                               |
| 500         | `INTERNAL_ERROR`      | Server error                                                       |

---

**Business Rules:**

1. Server melakukan `HMAC-SHA256(token, TOKEN_HMAC_SECRET)` untuk mendapatkan hash.
2. Hash dicari di tabel `VotingToken` dengan kondisi `used_at IS NULL`.
3. Jika tidak ditemukan, kembalikan `TOKEN_INVALID` — tidak membedakan antara "hash tidak cocok" dan "sudah dipakai" untuk keamanan.
4. Jika ditemukan, verifikasi bahwa election yang terkait berstatus `OPEN`.
5. Response hanya mengandung `electionId` dan `electionTitle` — **tidak mengekspos** `tokenId`, `token_hash`, atau informasi apapun yang bisa mengidentifikasi token.

**Side Effects:** Tidak ada — validasi token tidak mengubah state apapun.

**Audit Logging:** Tidak ada — validasi token bukan aksi admin.

**Anonymity Guarantee:** Token plaintext hanya ada di memori server selama pemrosesan. Tidak ada sesi atau state yang dibuat setelah response dikirim.

**Notes:** Client menyimpan `electionId` di client state (React state / sessionStorage) untuk digunakan pada langkah selanjutnya.

**PRD Reference:** §3 (Manajemen Token), §9.2 (Rate limiting)
**DB Tables:** `VotingToken`, `Election`

---

### V-02 — Cast Vote

**`POST /api/vote/cast`**

**Purpose:** Mencatat suara siswa secara atomik. Memvalidasi ulang token, memvalidasi kandidat, menandai token sebagai sudah dipakai, dan menyimpan suara — semua dalam satu transaksi database.

**Authentication:** None (stateless; token divalidasi ulang dari request body).

**Authorization:** N/A.

**Rate Limiting:** 3 request / 5 menit / IP.

---

**Request Headers:**

| Header         | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request Body:**

| Field         | Type     | Required | Deskripsi                                        |
| ------------- | -------- | -------- | ------------------------------------------------ |
| `token`       | `string` | Yes      | Token plaintext siswa (di-re-validasi di server) |
| `candidateId` | `string` | Yes      | CUID kandidat yang dipilih                       |
| `electionId`  | `string` | Yes      | CUID election yang aktif                         |

**Validation Rules:**

| Field         | Rule                                                         |
| ------------- | ------------------------------------------------------------ |
| `token`       | Required; string; min 8; max 64; tidak boleh whitespace saja |
| `candidateId` | Required; string; format CUID valid                          |
| `electionId`  | Required; string; format CUID valid                          |

---

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "message": "Suara berhasil dicatat. Terima kasih telah berpartisipasi."
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code                  | Kondisi                                               |
| ----------- | --------------------------- | ----------------------------------------------------- |
| 400         | `VALIDATION_ERROR`          | Field kosong, format CUID tidak valid                 |
| 400         | `TOKEN_INVALID`             | Token tidak ditemukan atau hash tidak cocok           |
| 409         | `TOKEN_ALREADY_USED`        | Token sudah dipakai (race condition terdeteksi di TX) |
| 404         | `ELECTION_NOT_FOUND`        | `electionId` tidak ditemukan                          |
| 422         | `ELECTION_NOT_OPEN`         | Election tidak dalam state `OPEN`                     |
| 404         | `CANDIDATE_NOT_FOUND`       | `candidateId` tidak ditemukan                         |
| 422         | `CANDIDATE_NOT_IN_ELECTION` | Kandidat tidak termasuk dalam election yang dimaksud  |
| 429         | `RATE_LIMIT_EXCEEDED`       | Rate limit terlampaui                                 |
| 500         | `INTERNAL_ERROR`            | Server error / DB error / rollback                    |

---

**Business Rules:**

1. Server melakukan `HMAC-SHA256(token, TOKEN_HMAC_SECRET)` dari token yang dikirim.
2. Database transaction dimulai (`BEGIN`).
3. `SELECT VotingToken WHERE token_hash = $hash AND used_at IS NULL FOR UPDATE` — lock row untuk mencegah race condition.
4. Jika tidak ditemukan → `ROLLBACK` → kembalikan `TOKEN_INVALID` atau `TOKEN_ALREADY_USED`.
5. Verifikasi `electionId` valid dan status `OPEN`.
6. Verifikasi `candidateId` valid dan `election_id` cocok.
7. `INSERT INTO Vote (election_id, candidate_id, voted_at)`.
8. `UPDATE VotingToken SET used_at = now() WHERE id = $tokenId`.
9. `COMMIT`.
10. Jika ada langkah yang gagal → `ROLLBACK` → tidak ada vote yang tersimpan, token tidak berubah.

**Side Effects:**

- `Vote` record baru di-insert.
- `VotingToken.used_at` di-set ke timestamp saat ini.
- Dashboard stats akan berubah pada polling berikutnya.

**Audit Logging:**

- `AuditLog` record dengan `action: VOTE_CAST` di-insert setelah transaksi COMMIT.
- **Tidak ada referensi ke `candidateId`, `tokenId`, atau identitas siswa** dalam audit log. _(PRD §7.3)_

**Anonymity Guarantee:**

- Response tidak mengandung kandidat yang dipilih, token hash, atau vote ID.
- `Vote` record yang tersimpan hanya berisi `election_id`, `candidate_id`, `voted_at` — tidak ada FK ke `VotingToken`. _(PRD §7.2, DB §5)_
- Tidak ada korelasi token ↔ kandidat yang bisa ditarik dari database maupun dari response.

**Idempotency:** Tidak idempoten — memanggil dua kali dengan token yang sama akan menghasilkan `TOKEN_ALREADY_USED` pada panggilan kedua (karena `used_at` sudah di-set pada panggilan pertama).

**PRD Reference:** §7.1 (Integritas Vote), §7.2 (Anonimitas)
**DB Tables:** `VotingToken`, `Vote`, `AuditLog`
**DB Transaction:** TX-1

---

## Authentication API

> Endpoint ini dikelola oleh **Auth.js (NextAuth)**. Dokumen ini mendeskripsikan perilaku dari perspektif API consumer, bukan implementasi internal NextAuth.

---

### A-01 — Admin Login

**`POST /api/auth/signin`**

**Purpose:** Autentikasi admin dengan username dan password. Membuat session JWT yang disimpan dalam HTTP-only cookie.

**Authentication:** None (endpoint ini adalah entry point autentikasi).

**Authorization:** N/A.

**Rate Limiting:** 5 request / 15 menit / IP. _(PRD §9.2)_

---

**Request Headers:**

| Header         | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request Body:**

| Field       | Type     | Required | Deskripsi                                                  |
| ----------- | -------- | -------- | ---------------------------------------------------------- |
| `username`  | `string` | Yes      | Username admin                                             |
| `password`  | `string` | Yes      | Password admin (plaintext — hanya dalam transit via HTTPS) |
| `csrfToken` | `string` | Yes      | CSRF token dari `GET /api/auth/csrf`                       |

**Validation Rules:**

| Field       | Rule                                                       |
| ----------- | ---------------------------------------------------------- |
| `username`  | Required; string; min 1; max 50                            |
| `password`  | Required; string; min 1; max 128                           |
| `csrfToken` | Required; string; disediakan otomatis oleh NextAuth client |

---

**Success Response — `200 OK`:**

```json
{
  "url": "/admin/dashboard"
}
```

Response header:

```
Set-Cookie: next-auth.session-token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/
```

**Possible Error Responses:**

| HTTP Status | Error Code            | Kondisi                                                          |
| ----------- | --------------------- | ---------------------------------------------------------------- |
| 401         | `UNAUTHORIZED`        | Username tidak ditemukan, admin tidak aktif, atau password salah |
| 429         | `RATE_LIMIT_EXCEEDED` | Terlalu banyak percobaan dari IP ini                             |

> **Security note:** Error untuk "username tidak ditemukan" dan "password salah" menggunakan pesan yang identik untuk mencegah user enumeration attack. _(PRD §9.2)_

---

**Business Rules:**

1. Server mencari `Admin` dengan `username = $username AND is_active = true`.
2. Jika tidak ditemukan → catat `ADMIN_LOGIN_FAILED` di AuditLog → kembalikan 401.
3. Verifikasi password dengan `argon2.verify(storedHash, inputPassword)`. _(PRD §9.2)_
4. Jika password salah → catat `ADMIN_LOGIN_FAILED` di AuditLog → kembalikan 401.
5. Update `Admin.last_login_at = now()`.
6. Catat `ADMIN_LOGIN_SUCCESS` di AuditLog dengan IP dan user agent.
7. Buat session JWT dengan payload: `{ id, username, role }`.
8. Set session cookie: HTTP-only, Secure, SameSite=Lax.

**Audit Logging:**

- `ADMIN_LOGIN_SUCCESS` atau `ADMIN_LOGIN_FAILED` per percobaan.
- IP address dan user agent selalu dicatat.

**PRD Reference:** §9.1 (Arsitektur Autentikasi Admin)
**DB Tables:** `Admin`, `AuditLog`

---

### A-02 — Admin Logout

**`POST /api/auth/signout`**

**Purpose:** Mengakhiri session admin. Menghapus session cookie.

**Authentication:** Admin session (cookie NextAuth).

**Authorization:** Semua role admin yang sedang aktif.

---

**Request Headers:**

| Header         | Value                           |
| -------------- | ------------------------------- |
| `Content-Type` | `application/json`              |
| `Cookie`       | `next-auth.session-token=<jwt>` |

**Request Body:**

| Field       | Type     | Required | Deskripsi                |
| ----------- | -------- | -------- | ------------------------ |
| `csrfToken` | `string` | Yes      | CSRF token dari NextAuth |

**Success Response — `200 OK`:**

```json
{
  "url": "/admin/login"
}
```

Response header:

```
Set-Cookie: next-auth.session-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/
```

**Business Rules:** Session JWT dihapus dari cookie. Tidak ada state server yang perlu di-cleanup (stateless JWT).

**Audit Logging:** Tidak dicatat (logout bukan aksi administratif yang signifikan). Dapat ditambahkan di v2 jika dibutuhkan untuk compliance.

**PRD Reference:** §9.1
**DB Tables:** Tidak ada.

---

### A-03 — Get Session

**`GET /api/auth/session`**

**Purpose:** Mendapatkan informasi session admin yang sedang aktif. Digunakan frontend untuk mengetahui apakah user terautentikasi dan role-nya.

**Authentication:** Admin session (cookie NextAuth).

**Authorization:** Semua role.

---

**Success Response — `200 OK` (authenticated):**

```json
{
  "user": {
    "id": "clxxx...",
    "username": "admin_panitia",
    "role": "ADMIN"
  },
  "expires": "2026-07-28T07:00:00.000Z"
}
```

**Success Response — `200 OK` (not authenticated):**

```json
{}
```

**Notes:** NextAuth mengembalikan objek kosong (bukan 401) jika tidak ada session aktif. Frontend harus memeriksa apakah `user` field ada dalam response.

---

## Election API

---

### E-01 — List Elections

**`GET /api/admin/elections`**

**Purpose:** Mendapatkan daftar semua election. Mendukung filtering berdasarkan status dan pagination.

**Authentication:** Admin session.

**Authorization:** `VIEWER`, `ADMIN`, `SUPER_ADMIN`.

---

**Query Parameters:**

| Parameter          | Type    | Required | Default     | Deskripsi                                                               |
| ------------------ | ------- | -------- | ----------- | ----------------------------------------------------------------------- |
| `page`             | integer | No       | 1           | Nomor halaman                                                           |
| `pageSize`         | integer | No       | 20          | Item per halaman (max 100)                                              |
| `filterBy[status]` | enum    | No       | —           | Filter status: `SETUP`, `READY`, `OPEN`, `PAUSED`, `CLOSED`, `ARCHIVED` |
| `sortBy`           | string  | No       | `createdAt` | Field sorting: `createdAt`, `title`, `status`                           |
| `sortOrder`        | enum    | No       | `desc`      | `asc` atau `desc`                                                       |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxxx...",
        "title": "Pilketos 2025/2026",
        "description": "Pemilihan Ketua OSIS periode 2025/2026",
        "status": "OPEN",
        "candidateCount": 3,
        "tokenCount": 200,
        "usedTokenCount": 87,
        "openedAt": "2026-07-27T08:00:00.000Z",
        "closedAt": null,
        "createdAt": "2026-07-20T10:00:00.000Z",
        "createdBy": {
          "id": "clyyy...",
          "username": "admin_panitia"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

**Notes:** `candidateCount`, `tokenCount`, dan `usedTokenCount` adalah computed fields dari aggregate query — bukan kolom di tabel `Election`.

**PRD Reference:** §6 (State Machine)
**DB Tables:** `Election`, `Candidate`, `VotingToken`

---

### E-02 — Create Election

**`POST /api/admin/elections`**

**Purpose:** Membuat election baru dengan state awal `SETUP`.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

**Request Body:**

| Field         | Type     | Required | Deskripsi                  |
| ------------- | -------- | -------- | -------------------------- |
| `title`       | `string` | Yes      | Judul election             |
| `description` | `string` | No       | Deskripsi singkat opsional |

**Validation Rules:**

| Field         | Rule                                                          |
| ------------- | ------------------------------------------------------------- |
| `title`       | Required; string; min 3; max 255; tidak boleh whitespace saja |
| `description` | Opsional; string; max 1000; nullable                          |

**Success Response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "title": "Pilketos 2025/2026",
    "description": null,
    "status": "SETUP",
    "candidateCount": 0,
    "tokenCount": 0,
    "usedTokenCount": 0,
    "openedAt": null,
    "closedAt": null,
    "createdAt": "2026-07-27T10:00:00.000Z",
    "createdBy": {
      "id": "clyyy...",
      "username": "admin_panitia"
    }
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code               | Kondisi                                           |
| ----------- | ------------------------ | ------------------------------------------------- |
| 400         | `VALIDATION_ERROR`       | Field tidak valid                                 |
| 422         | `ACTIVE_ELECTION_EXISTS` | Sudah ada election berstatus `OPEN` atau `PAUSED` |
| 401         | `UNAUTHORIZED`           | Tidak terautentikasi                              |
| 403         | `FORBIDDEN`              | Role `VIEWER` tidak bisa create                   |
| 500         | `INTERNAL_ERROR`         | DB error                                          |

**Business Rules:**

1. Status awal selalu `SETUP` — tidak bisa di-override.
2. Sistem memvalidasi bahwa tidak ada election lain yang berstatus `OPEN` atau `PAUSED` sebelum membuat election baru. _(DB: partial unique index)_
3. `created_by` diambil dari session JWT — bukan dari request body.

**Side Effects:** Election baru di-insert ke database.

**Audit Logging:** `ELECTION_CREATED` dengan `target_id: electionId`, `metadata: { title }`.

**PRD Reference:** §6 (State Machine), Design Decisions (satu election aktif)
**DB Tables:** `Election`, `AuditLog`

---

### E-03 — Get Election Detail

**`GET /api/admin/elections/[id]`**

**Purpose:** Mendapatkan detail lengkap satu election termasuk daftar kandidat dan statistik token.

**Authentication:** Admin session.

**Authorization:** `VIEWER`, `ADMIN`, `SUPER_ADMIN`.

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi   |
| --------- | ---- | -------- | ----------- |
| `id`      | CUID | Yes      | ID election |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "title": "Pilketos 2025/2026",
    "description": "Pemilihan Ketua OSIS periode 2025/2026",
    "status": "OPEN",
    "openedAt": "2026-07-27T08:00:00.000Z",
    "closedAt": null,
    "createdAt": "2026-07-20T10:00:00.000Z",
    "updatedAt": "2026-07-27T08:00:00.000Z",
    "createdBy": {
      "id": "clyyy...",
      "username": "admin_panitia"
    },
    "candidates": [
      {
        "id": "clzzz...",
        "orderNumber": 1,
        "name": "Budi Santoso",
        "className": "XII IPA 1",
        "photoUrl": "https://storage.supabase.co/...",
        "vision": "Mewujudkan OSIS yang aktif dan inovatif",
        "missions": [
          "Mengadakan program pelatihan kepemimpinan",
          "Meningkatkan transparansi kegiatan OSIS",
          "Membangun forum aspirasi siswa"
        ]
      }
    ],
    "tokenStats": {
      "total": 200,
      "used": 87,
      "remaining": 113,
      "participationRate": 43.5
    }
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code           | Kondisi                                |
| ----------- | -------------------- | -------------------------------------- |
| 400         | `VALIDATION_ERROR`   | `id` bukan CUID valid                  |
| 404         | `ELECTION_NOT_FOUND` | Election dengan ID ini tidak ditemukan |
| 401         | `UNAUTHORIZED`       | Tidak terautentikasi                   |

**Notes:** `participationRate` dihitung sebagai `(used / total) * 100`, dibulatkan ke 1 desimal.

**PRD Reference:** §6, §8
**DB Tables:** `Election`, `Candidate`, `VotingToken`

---

### E-04 — Update Election Status (State Machine)

**`PATCH /api/admin/elections/[id]/status`**

**Purpose:** Melakukan transisi state election sesuai state machine yang telah didefinisikan. _(PRD §6)_

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi   |
| --------- | ---- | -------- | ----------- |
| `id`      | CUID | Yes      | ID election |

**Request Body:**

| Field    | Type             | Required | Deskripsi                |
| -------- | ---------------- | -------- | ------------------------ |
| `status` | `ElectionStatus` | Yes      | Status baru yang diminta |

**Validation Rules:**

| Field    | Rule                                                            |
| -------- | --------------------------------------------------------------- |
| `status` | Required; enum: `READY`, `OPEN`, `PAUSED`, `CLOSED`, `ARCHIVED` |

> `SETUP` tidak termasuk dalam enum yang valid untuk endpoint ini — state `SETUP` hanya dicapai saat election baru dibuat.

---

**State Transition Matrix:**

| Status Saat Ini | Status Baru yang Diizinkan | Prasyarat                                       |
| --------------- | -------------------------- | ----------------------------------------------- |
| `SETUP`         | `READY`                    | Minimal 2 kandidat; minimal 1 token di-generate |
| `READY`         | `OPEN`                     | Tidak ada election lain yang `OPEN`/`PAUSED`    |
| `OPEN`          | `PAUSED`                   | —                                               |
| `OPEN`          | `CLOSED`                   | —                                               |
| `PAUSED`        | `OPEN`                     | —                                               |
| `PAUSED`        | `CLOSED`                   | —                                               |
| `CLOSED`        | `ARCHIVED`                 | —                                               |
| `ARCHIVED`      | —                          | Tidak ada transisi yang diizinkan               |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "status": "OPEN",
    "openedAt": "2026-07-27T08:00:00.000Z",
    "updatedAt": "2026-07-27T08:00:00.000Z"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code                    | Kondisi                                      |
| ----------- | ----------------------------- | -------------------------------------------- |
| 400         | `VALIDATION_ERROR`            | `status` bukan enum valid                    |
| 404         | `ELECTION_NOT_FOUND`          | Election tidak ditemukan                     |
| 422         | `ELECTION_TRANSITION_INVALID` | Transisi tidak diizinkan dari state saat ini |
| 422         | `ELECTION_MIN_CANDIDATES`     | Kurang dari 2 kandidat (saat SETUP → READY)  |
| 422         | `ACTIVE_ELECTION_EXISTS`      | Sudah ada election aktif (saat READY → OPEN) |
| 401         | `UNAUTHORIZED`                | Tidak terautentikasi                         |
| 403         | `FORBIDDEN`                   | Role `VIEWER` tidak bisa ubah status         |

**Business Rules:**

1. Transisi hanya bisa maju (kecuali OPEN ↔ PAUSED). _(PRD §6)_
2. Saat transisi ke `OPEN`: set `openedAt = now()`.
3. Saat transisi ke `CLOSED`: set `closedAt = now()`.
4. Transisi dieksekusi dalam database transaction bersama insert AuditLog. _(DB TX-2)_

**Audit Logging:** `ELECTION_STATUS_CHANGED` dengan `metadata: { from: "SETUP", to: "READY" }`.

**PRD Reference:** §6 (State Machine)
**DB Tables:** `Election`, `AuditLog`
**DB Transaction:** TX-2

---

### E-05 — Delete Election

**`DELETE /api/admin/elections/[id]`**

**Purpose:** Menghapus election secara permanen (hard delete). Hanya diizinkan untuk state `SETUP` atau `ARCHIVED`.

**Authentication:** Admin session.

**Authorization:** `SUPER_ADMIN` only. _(PRD §1.3)_

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi   |
| --------- | ---- | -------- | ----------- |
| `id`      | CUID | Yes      | ID election |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "message": "Election berhasil dihapus.",
    "deletedId": "clxxx..."
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code             | Kondisi                                            |
| ----------- | ---------------------- | -------------------------------------------------- |
| 404         | `ELECTION_NOT_FOUND`   | Election tidak ditemukan                           |
| 422         | `ELECTION_WRONG_STATE` | Election bukan dalam state `SETUP` atau `ARCHIVED` |
| 401         | `UNAUTHORIZED`         | Tidak terautentikasi                               |
| 403         | `FORBIDDEN`            | Hanya `SUPER_ADMIN` yang bisa hapus                |

**Business Rules:**

1. Hanya state `SETUP` atau `ARCHIVED` yang boleh dihapus.
2. Election dalam state `READY`, `OPEN`, `PAUSED`, atau `CLOSED` tidak bisa dihapus — harus `ARCHIVE` dulu.
3. Cascade delete: semua `Candidate`, `VotingToken`, dan `Vote` yang terkait ikut terhapus. _(DB: CASCADE)_

**Audit Logging:** `ELECTION_DELETED` dengan `metadata: { title, status }`.

**PRD Reference:** §1.3 (Permission Matrix)
**DB Tables:** `Election`, `Candidate`, `VotingToken`, `Vote`, `AuditLog`

---

## Candidate API

---

### C-01 — List Candidates

**`GET /api/admin/candidates`**

**Purpose:** Mendapatkan daftar kandidat untuk election tertentu, diurutkan berdasarkan nomor urut.

**Authentication:** Admin session.

**Authorization:** `VIEWER`, `ADMIN`, `SUPER_ADMIN`.

---

**Query Parameters:**

| Parameter    | Type | Required | Deskripsi                                  |
| ------------ | ---- | -------- | ------------------------------------------ |
| `electionId` | CUID | Yes      | ID election yang kandidatnya ingin dilihat |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clzzz...",
        "electionId": "clxxx...",
        "orderNumber": 1,
        "name": "Budi Santoso",
        "className": "XII IPA 1",
        "photoUrl": "https://storage.supabase.co/...",
        "vision": "Mewujudkan OSIS yang aktif dan inovatif",
        "missions": [
          "Mengadakan program pelatihan kepemimpinan",
          "Meningkatkan transparansi kegiatan OSIS"
        ],
        "voteCount": 34,
        "createdAt": "2026-07-20T11:00:00.000Z",
        "updatedAt": "2026-07-20T11:00:00.000Z"
      }
    ]
  }
}
```

**Notes:**

- Tidak ada pagination — jumlah kandidat maksimal 5. _(PRD §2)_
- `voteCount` hanya dikembalikan jika election sudah `CLOSED` atau `ARCHIVED`. Saat `OPEN` atau `PAUSED`, `voteCount` adalah `null` untuk mencegah inferensi real-time. _(PRD §8, throttle rationale)_
- Diurutkan ascending berdasarkan `orderNumber`.

**PRD Reference:** §2 (Manajemen Kandidat)
**DB Tables:** `Candidate`, `Vote`

---

### C-02 — Create Candidate

**`POST /api/admin/candidates`**

**Purpose:** Menambahkan kandidat baru ke dalam election. Hanya bisa dilakukan saat election berstatus `SETUP`.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

**Request Body:**

| Field         | Type       | Required | Deskripsi                             |
| ------------- | ---------- | -------- | ------------------------------------- |
| `electionId`  | `string`   | Yes      | CUID election yang dituju             |
| `orderNumber` | `integer`  | Yes      | Nomor urut (1–5), unik dalam election |
| `name`        | `string`   | Yes      | Nama lengkap kandidat                 |
| `className`   | `string`   | Yes      | Kelas kandidat                        |
| `vision`      | `string`   | Yes      | Visi kandidat                         |
| `missions`    | `string[]` | Yes      | Array misi (min 1 item)               |

**Validation Rules:**

| Field         | Rule                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| `electionId`  | Required; CUID valid                                                        |
| `orderNumber` | Required; integer; min 1; max 5                                             |
| `name`        | Required; string; min 2; max 255                                            |
| `className`   | Required; string; min 1; max 50                                             |
| `vision`      | Required; string; min 10; max 1000                                          |
| `missions`    | Required; array; min 1 item; max 10 items; setiap item string min 5 max 500 |

> **Catatan:** `photoUrl` tidak ada di create body — foto di-upload terpisah via `POST /api/admin/candidates/[id]/photo`. Kandidat bisa dibuat tanpa foto terlebih dahulu (photo_url akan `null` sementara).

**Success Response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "clzzz...",
    "electionId": "clxxx...",
    "orderNumber": 1,
    "name": "Budi Santoso",
    "className": "XII IPA 1",
    "photoUrl": null,
    "vision": "Mewujudkan OSIS yang aktif dan inovatif",
    "missions": ["Mengadakan program pelatihan kepemimpinan"],
    "createdAt": "2026-07-20T11:00:00.000Z",
    "updatedAt": "2026-07-20T11:00:00.000Z"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code                | Kondisi                                |
| ----------- | ------------------------- | -------------------------------------- |
| 400         | `VALIDATION_ERROR`        | Field tidak valid                      |
| 404         | `ELECTION_NOT_FOUND`      | Election tidak ditemukan               |
| 422         | `ELECTION_WRONG_STATE`    | Election bukan dalam state `SETUP`     |
| 422         | `ELECTION_MAX_CANDIDATES` | Sudah ada 5 kandidat                   |
| 409         | `ORDER_NUMBER_TAKEN`      | Nomor urut sudah dipakai kandidat lain |
| 401         | `UNAUTHORIZED`            | Tidak terautentikasi                   |
| 403         | `FORBIDDEN`               | Role tidak memiliki akses              |

**Business Rules:**

1. Kandidat hanya bisa ditambah saat election `status = SETUP`. _(PRD §2)_
2. Maksimal 5 kandidat per election. _(PRD §2)_
3. `orderNumber` harus unik dalam scope election yang sama.

**Audit Logging:** `CANDIDATE_CREATED` dengan `metadata: { name, orderNumber }`.

**PRD Reference:** §2 (Manajemen Kandidat)
**DB Tables:** `Candidate`, `Election`, `AuditLog`

---

### C-03 — Update Candidate

**`PATCH /api/admin/candidates/[id]`**

**Purpose:** Memperbarui data kandidat. Hanya bisa dilakukan saat election terkait berstatus `SETUP`.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi   |
| --------- | ---- | -------- | ----------- |
| `id`      | CUID | Yes      | ID kandidat |

**Request Body (semua field opsional, minimal 1 harus dikirim):**

| Field         | Type       | Required | Deskripsi                               |
| ------------- | ---------- | -------- | --------------------------------------- |
| `orderNumber` | `integer`  | No       | Nomor urut baru (1–5)                   |
| `name`        | `string`   | No       | Nama lengkap baru                       |
| `className`   | `string`   | No       | Kelas baru                              |
| `vision`      | `string`   | No       | Visi baru                               |
| `missions`    | `string[]` | No       | Array misi baru (replace seluruh array) |

**Validation Rules:**

| Field         | Rule                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| `orderNumber` | Opsional; integer; min 1; max 5                                             |
| `name`        | Opsional; string; min 2; max 255                                            |
| `className`   | Opsional; string; min 1; max 50                                             |
| `vision`      | Opsional; string; min 10; max 1000                                          |
| `missions`    | Opsional; array; min 1 item; max 10 items; setiap item string min 5 max 500 |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "clzzz...",
    "orderNumber": 2,
    "name": "Budi Santoso Updated",
    "className": "XII IPA 2",
    "photoUrl": "https://...",
    "vision": "Visi yang diperbarui",
    "missions": ["Misi satu", "Misi dua"],
    "updatedAt": "2026-07-21T09:00:00.000Z"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code             | Kondisi                                             |
| ----------- | ---------------------- | --------------------------------------------------- |
| 400         | `VALIDATION_ERROR`     | Field tidak valid atau tidak ada field yang dikirim |
| 404         | `CANDIDATE_NOT_FOUND`  | Kandidat tidak ditemukan                            |
| 422         | `ELECTION_WRONG_STATE` | Election bukan `SETUP`                              |
| 409         | `ORDER_NUMBER_TAKEN`   | Nomor urut baru sudah dipakai                       |
| 401         | `UNAUTHORIZED`         | Tidak terautentikasi                                |
| 403         | `FORBIDDEN`            | Role tidak memiliki akses                           |

**Audit Logging:** `CANDIDATE_UPDATED` dengan `metadata: { changedFields: ["name", "vision"] }`.

**PRD Reference:** §2
**DB Tables:** `Candidate`, `Election`, `AuditLog`

---

### C-04 — Delete Candidate

**`DELETE /api/admin/candidates/[id]`**

**Purpose:** Menghapus kandidat dari election. Hanya bisa dilakukan saat election berstatus `SETUP` dan kandidat belum memiliki suara.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi   |
| --------- | ---- | -------- | ----------- |
| `id`      | CUID | Yes      | ID kandidat |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "message": "Kandidat berhasil dihapus.",
    "deletedId": "clzzz..."
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code             | Kondisi                             |
| ----------- | ---------------------- | ----------------------------------- |
| 404         | `CANDIDATE_NOT_FOUND`  | Kandidat tidak ditemukan            |
| 422         | `ELECTION_WRONG_STATE` | Election bukan `SETUP`              |
| 409         | `CANDIDATE_HAS_VOTES`  | Kandidat sudah memiliki suara masuk |
| 401         | `UNAUTHORIZED`         | Tidak terautentikasi                |
| 403         | `FORBIDDEN`            | Role tidak memiliki akses           |

**Business Rules:**

1. Setelah election `SETUP`, kandidat tidak bisa dihapus.
2. `CANDIDATE_HAS_VOTES` secara praktis tidak akan terjadi jika rule (1) diikuti — namun tetap di-handle sebagai safety net dari database constraint `ON DELETE RESTRICT`. _(DB §5)_

**Audit Logging:** `CANDIDATE_DELETED` dengan `metadata: { name, orderNumber }`.

**PRD Reference:** §2
**DB Tables:** `Candidate`, `Vote`, `AuditLog`

---

### C-05 — Upload Candidate Photo

**`POST /api/admin/candidates/[id]/photo`**

**Purpose:** Mengupload foto kandidat ke storage. Menggantikan foto lama jika ada.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi   |
| --------- | ---- | -------- | ----------- |
| `id`      | CUID | Yes      | ID kandidat |

**Request Headers:**

| Header         | Value                 |
| -------------- | --------------------- |
| `Content-Type` | `multipart/form-data` |

**Request Body (multipart):**

| Field   | Type   | Required | Deskripsi          |
| ------- | ------ | -------- | ------------------ |
| `photo` | `File` | Yes      | File foto kandidat |

**Validation Rules:**

| Field   | Rule                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| `photo` | Required; file; MIME type harus `image/jpeg`, `image/png`, atau `image/webp`; max size 2MB |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "candidateId": "clzzz...",
    "photoUrl": "https://storage.supabase.co/v1/object/public/candidates/clzzz.../photo.webp"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code             | Kondisi                       |
| ----------- | ---------------------- | ----------------------------- |
| 400         | `VALIDATION_ERROR`     | File tidak disertakan         |
| 400         | `INVALID_FILE_TYPE`    | MIME type bukan JPEG/PNG/WebP |
| 400         | `FILE_TOO_LARGE`       | File > 2MB                    |
| 404         | `CANDIDATE_NOT_FOUND`  | Kandidat tidak ditemukan      |
| 422         | `ELECTION_WRONG_STATE` | Election bukan `SETUP`        |
| 500         | `PHOTO_UPLOAD_FAILED`  | Storage service error         |

**Business Rules:**

1. Foto diupload via `StorageService` (abstraction layer). _(Arch §StorageService Abstraction)_
2. Jika kandidat sudah punya foto, foto lama dihapus dari storage sebelum foto baru diupload.
3. Path storage: `candidates/{candidateId}/photo.{ext}`.
4. `Candidate.photo_url` diupdate setelah upload berhasil.

**Audit Logging:** `CANDIDATE_UPDATED` dengan `metadata: { changedFields: ["photoUrl"] }`.

**PRD Reference:** §2
**DB Tables:** `Candidate`, `AuditLog`

---

## Token API

---

### T-01 — Generate Token Batch

**`POST /api/admin/tokens/generate`**

**Purpose:** Membangkitkan batch token baru dalam satu operasi atomik. Token plaintext hanya dikembalikan sekali dalam response ini — tidak pernah disimpan di database. Database hanya menyimpan HMAC-SHA256 hash.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

**Rate Limiting:** 5 request / 5 menit / IP.

---

**Request Body:**

| Field        | Type      | Required | Deskripsi                          |
| ------------ | --------- | -------- | ---------------------------------- |
| `electionId` | `string`  | Yes      | CUID election yang dituju          |
| `count`      | `integer` | Yes      | Jumlah token yang akan di-generate |

**Validation Rules:**

| Field        | Rule                               |
| ------------ | ---------------------------------- |
| `electionId` | Required; CUID valid               |
| `count`      | Required; integer; min 1; max 2000 |

---

**Success Response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "electionId": "clxxx...",
    "generatedCount": 200,
    "tokens": ["TKN-A3F8K2", "TKN-B7X9P1", "..."],
    "note": "PENTING: Simpan token ini sekarang. Token plaintext tidak akan bisa diakses lagi setelah response ini."
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code                     | Kondisi                            |
| ----------- | ------------------------------ | ---------------------------------- |
| 400         | `VALIDATION_ERROR`             | Field tidak valid                  |
| 404         | `ELECTION_NOT_FOUND`           | Election tidak ditemukan           |
| 422         | `TOKEN_GENERATION_ACTIVE_ONLY` | Election bukan dalam state `SETUP` |
| 401         | `UNAUTHORIZED`                 | Tidak terautentikasi               |
| 403         | `FORBIDDEN`                    | Role tidak memiliki akses          |
| 429         | `RATE_LIMIT_EXCEEDED`          | Rate limit terlampaui              |
| 500         | `INTERNAL_ERROR`               | DB error                           |

---

**Business Rules:**

1. Hanya bisa di-generate saat election `status = SETUP`. _(PRD §3)_
2. Untuk setiap token: generate string random yang aman secara kriptografis (minimum 12 karakter).
3. Hitung `HMAC-SHA256(tokenPlaintext, TOKEN_HMAC_SECRET)` — simpan hash ke database, bukan plaintext. _(PRD §3)_
4. Semua INSERT dilakukan dalam satu transaksi database. Jika ada yang gagal, semua di-rollback. _(DB TX-3)_
5. Token plaintext dikembalikan dalam response untuk satu kali — setelah ini tidak bisa diakses lagi.
6. Tidak ada batas total token per election — admin bertanggung jawab atas jumlah yang wajar.

**Side Effects:**

- Batch `VotingToken` records di-insert ke database.

**Audit Logging:** `TOKEN_BATCH_GENERATED` dengan `metadata: { count: 200, electionId }`.

**Idempotency:** Tidak idempoten — setiap call menghasilkan token baru.

**Notes:**

- Frontend harus segera menawarkan download CSV setelah menerima response ini.
- Token plaintext tidak bisa di-recover dari database — jika hilang, harus generate ulang.

**PRD Reference:** §3 (Manajemen Token)
**DB Tables:** `VotingToken`, `AuditLog`
**DB Transaction:** TX-3

---

### T-02 — Export Tokens as CSV

**`GET /api/admin/tokens/export`**

**Purpose:** Mengekspor token plaintext dalam format CSV. **PENTING:** Endpoint ini hanya bisa dipanggil segera setelah generate (dalam window tertentu) — **bukan** untuk recovery token yang sudah lama di-generate (karena plaintext tidak tersimpan di DB). Lihat Business Rules.

**Authentication:** Admin session.

**Authorization:** `ADMIN`, `SUPER_ADMIN`.

---

> **Catatan Arsitektur Penting:** Token plaintext **tidak pernah tersimpan di database**. Database hanya menyimpan HMAC hash. Endpoint ini tidak dapat mengembalikan token plaintext dari database.
>
> **Desain yang direkomendasikan:** Setelah `POST /api/admin/tokens/generate`, frontend secara otomatis menawarkan download CSV dari response tersebut tanpa perlu endpoint export terpisah.
>
> Lihat **Review Notes** di bagian akhir dokumen untuk detail konflik desain ini.

**Query Parameters:**

| Parameter    | Type | Required | Deskripsi   |
| ------------ | ---- | -------- | ----------- |
| `electionId` | CUID | Yes      | ID election |

**Success Response — `200 OK`:**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="tokens-pilketos-2026.csv"

token_number,created_at
1,2026-07-20T10:00:00.000Z
2,2026-07-20T10:00:00.000Z
```

> **Catatan:** CSV hanya berisi metadata token (nomor urut, timestamp), bukan token plaintext — karena plaintext tidak tersimpan di DB. Frontend yang bertanggung jawab menyimpan dan mengekspos plaintext dari response generate.

**Possible Error Responses:**

| HTTP Status | Error Code           | Kondisi                   |
| ----------- | -------------------- | ------------------------- |
| 400         | `VALIDATION_ERROR`   | `electionId` tidak valid  |
| 404         | `ELECTION_NOT_FOUND` | Election tidak ditemukan  |
| 401         | `UNAUTHORIZED`       | Tidak terautentikasi      |
| 403         | `FORBIDDEN`          | Role tidak memiliki akses |

**Audit Logging:** `TOKEN_BATCH_EXPORTED` dengan `metadata: { electionId, tokenCount }`.

**PRD Reference:** §3
**DB Tables:** `VotingToken`

---

## Dashboard API

---

### D-01 — Get Dashboard Statistics

**`GET /api/admin/dashboard/stats`**

**Purpose:** Mendapatkan statistik agregat election yang aktif untuk ditampilkan di dashboard. Didesain untuk dipanggil secara polling setiap 3–5 detik. _(Arch §Flow 5)_

**Authentication:** Admin session.

**Authorization:** `VIEWER`, `ADMIN`, `SUPER_ADMIN`.

---

**Query Parameters:**

| Parameter    | Type | Required | Deskripsi                 |
| ------------ | ---- | -------- | ------------------------- |
| `electionId` | CUID | Yes      | ID election yang dipantau |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "election": {
      "id": "clxxx...",
      "title": "Pilketos 2025/2026",
      "status": "OPEN",
      "openedAt": "2026-07-27T08:00:00.000Z"
    },
    "totalVotes": 87,
    "totalTokens": 200,
    "usedTokens": 87,
    "participationRate": 43.5,
    "lastVoteAt": "2026-07-27T10:35:22.000Z",
    "candidateStats": [
      {
        "candidateId": "clzzz...",
        "orderNumber": 1,
        "name": "Budi Santoso",
        "voteCount": 34,
        "percentage": 39.08
      },
      {
        "candidateId": "claaa...",
        "orderNumber": 2,
        "name": "Siti Rahma",
        "voteCount": 53,
        "percentage": 60.92
      }
    ],
    "generatedAt": "2026-07-27T10:35:30.000Z"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code           | Kondisi                  |
| ----------- | -------------------- | ------------------------ |
| 400         | `VALIDATION_ERROR`   | `electionId` tidak valid |
| 404         | `ELECTION_NOT_FOUND` | Election tidak ditemukan |
| 401         | `UNAUTHORIZED`       | Tidak terautentikasi     |

---

**Business Rules:**

1. Response selalu berupa **aggregate data** — tidak pernah individual vote records. _(PRD §8)_
2. `percentage` dihitung per kandidat: `(voteCount / totalVotes) * 100`, dibulatkan ke 2 desimal. Jika `totalVotes = 0`, semua percentage adalah `0`.
3. `participationRate` = `(usedTokens / totalTokens) * 100`, dibulatkan ke 1 desimal.
4. `lastVoteAt` adalah timestamp dari `MAX(voted_at)` di tabel `Vote` untuk election ini. Null jika belum ada vote.
5. `generatedAt` adalah timestamp server saat query dieksekusi.
6. Endpoint ini dapat di-cache sangat singkat (misalnya 1–2 detik) di server untuk mengurangi beban DB jika polling sangat agresif dari multiple admin clients.

**Anonymity Notes:** Response tidak mengandung data per-voter, tidak ada token information, tidak ada timestamp per-vote individual. Hanya aggregate.

**PRD Reference:** §8 (Realtime Dashboard)
**DB Tables:** `Election`, `Vote`, `Candidate`, `VotingToken`

---

## Audit API

---

### AU-01 — List Audit Logs

**`GET /api/admin/audit`**

**Purpose:** Mendapatkan daftar audit log dengan filtering dan pagination. Audit log bersifat read-only — tidak ada endpoint untuk update atau delete. _(PRD §7.3)_

**Authentication:** Admin session.

**Authorization:** `VIEWER`, `ADMIN`, `SUPER_ADMIN`.

---

**Query Parameters:**

| Parameter              | Type     | Required | Default     | Deskripsi                                    |
| ---------------------- | -------- | -------- | ----------- | -------------------------------------------- |
| `page`                 | integer  | No       | 1           | Nomor halaman                                |
| `pageSize`             | integer  | No       | 20          | Item per halaman (max 100)                   |
| `sortBy`               | string   | No       | `createdAt` | Hanya `createdAt` yang didukung              |
| `sortOrder`            | enum     | No       | `desc`      | `asc` atau `desc`                            |
| `filterBy[action]`     | enum     | No       | —           | Filter berdasarkan `AuditAction` enum        |
| `filterBy[actorId]`    | CUID     | No       | —           | Filter berdasarkan admin yang melakukan aksi |
| `filterBy[result]`     | enum     | No       | —           | `SUCCESS` atau `FAILURE`                     |
| `filterBy[targetType]` | string   | No       | —           | `election`, `candidate`, `token`, `admin`    |
| `filterBy[targetId]`   | string   | No       | —           | ID entitas target                            |
| `filterBy[dateFrom]`   | ISO 8601 | No       | —           | Filter aksi sejak tanggal ini (inclusive)    |
| `filterBy[dateTo]`     | ISO 8601 | No       | —           | Filter aksi sampai tanggal ini (inclusive)   |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cllog...",
        "actor": {
          "id": "clyyy...",
          "username": "admin_panitia",
          "role": "ADMIN"
        },
        "action": "ELECTION_STATUS_CHANGED",
        "targetType": "election",
        "targetId": "clxxx...",
        "result": "SUCCESS",
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0 ...",
        "metadata": {
          "from": "SETUP",
          "to": "READY"
        },
        "createdAt": "2026-07-27T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 347,
      "totalPages": 18,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code         | Kondisi                     |
| ----------- | ------------------ | --------------------------- |
| 400         | `VALIDATION_ERROR` | Parameter query tidak valid |
| 401         | `UNAUTHORIZED`     | Tidak terautentikasi        |

**Business Rules:**

1. Tidak ada endpoint untuk CREATE, UPDATE, atau DELETE audit log. _(PRD §7.3)_
2. `ipAddress` ditampilkan dalam response — hanya untuk admin, bukan publik.
3. `userAgent` dapat di-truncate di response jika terlalu panjang (max 500 karakter).

**PRD Reference:** §7.3 (Audit Log)
**DB Tables:** `AuditLog`, `Admin`

---

## Admin Management API

> Seluruh endpoint di bawah ini hanya dapat diakses oleh **`SUPER_ADMIN`**. _(PRD §1.3)_

---

### AM-01 — List Admins

**`GET /api/admin/admins`**

**Purpose:** Mendapatkan daftar semua akun admin.

**Authentication:** Admin session.

**Authorization:** `SUPER_ADMIN` only.

---

**Query Parameters:**

| Parameter            | Type    | Required | Default | Deskripsi                        |
| -------------------- | ------- | -------- | ------- | -------------------------------- |
| `page`               | integer | No       | 1       | Nomor halaman                    |
| `pageSize`           | integer | No       | 20      | Item per halaman                 |
| `filterBy[role]`     | enum    | No       | —       | `SUPER_ADMIN`, `ADMIN`, `VIEWER` |
| `filterBy[isActive]` | boolean | No       | —       | `true` atau `false`              |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clyyy...",
        "username": "admin_panitia",
        "email": "panitia@sekolah.sch.id",
        "role": "ADMIN",
        "isActive": true,
        "lastLoginAt": "2026-07-27T08:30:00.000Z",
        "createdAt": "2026-07-01T00:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

**Notes:** `passwordHash` tidak pernah dikembalikan dalam response apapun.

**PRD Reference:** §1.2, §1.3
**DB Tables:** `Admin`

---

### AM-02 — Create Admin

**`POST /api/admin/admins`**

**Purpose:** Membuat akun admin baru.

**Authentication:** Admin session.

**Authorization:** `SUPER_ADMIN` only.

---

**Request Body:**

| Field      | Type        | Required | Deskripsi                                         |
| ---------- | ----------- | -------- | ------------------------------------------------- |
| `username` | `string`    | Yes      | Username unik                                     |
| `email`    | `string`    | Yes      | Email unik                                        |
| `password` | `string`    | Yes      | Password plaintext (akan di-hash dengan Argon2id) |
| `role`     | `AdminRole` | Yes      | `SUPER_ADMIN`, `ADMIN`, atau `VIEWER`             |

**Validation Rules:**

| Field      | Rule                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| `username` | Required; string; min 3; max 50; alphanumeric + underscore; tidak boleh berisi spasi |
| `email`    | Required; valid email format; max 255                                                |
| `password` | Required; string; min 8; max 128; harus mengandung huruf besar, huruf kecil, angka   |
| `role`     | Required; enum: `SUPER_ADMIN`, `ADMIN`, `VIEWER`                                     |

**Success Response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "clnew...",
    "username": "viewer_satu",
    "email": "viewer@sekolah.sch.id",
    "role": "VIEWER",
    "isActive": true,
    "createdAt": "2026-07-27T12:00:00.000Z"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code             | Kondisi                  |
| ----------- | ---------------------- | ------------------------ |
| 400         | `VALIDATION_ERROR`     | Field tidak valid        |
| 409         | `ADMIN_USERNAME_TAKEN` | Username sudah digunakan |
| 409         | `ADMIN_EMAIL_TAKEN`    | Email sudah digunakan    |
| 401         | `UNAUTHORIZED`         | Tidak terautentikasi     |
| 403         | `FORBIDDEN`            | Bukan `SUPER_ADMIN`      |

**Business Rules:**

1. Password di-hash menggunakan Argon2id sebelum disimpan. _(PRD §9.2)_
2. `passwordHash` tidak pernah dikembalikan dalam response.
3. `isActive` selalu `true` saat pertama kali dibuat.

**Audit Logging:** `ADMIN_CREATED` dengan `metadata: { username, role }`.

**PRD Reference:** §1.2, §9.2
**DB Tables:** `Admin`, `AuditLog`

---

### AM-03 — Update Admin

**`PATCH /api/admin/admins/[id]`**

**Purpose:** Memperbarui data admin: mengubah role, status aktif, email, atau mereset password.

**Authentication:** Admin session.

**Authorization:** `SUPER_ADMIN` only.

---

**Path Parameters:**

| Parameter | Type | Required | Deskripsi                   |
| --------- | ---- | -------- | --------------------------- |
| `id`      | CUID | Yes      | ID admin yang akan diupdate |

**Request Body (semua field opsional, minimal 1 harus dikirim):**

| Field      | Type        | Required | Deskripsi                                 |
| ---------- | ----------- | -------- | ----------------------------------------- |
| `role`     | `AdminRole` | No       | Role baru                                 |
| `isActive` | `boolean`   | No       | `false` untuk menonaktifkan (soft delete) |
| `email`    | `string`    | No       | Email baru                                |
| `password` | `string`    | No       | Password baru (akan di-hash ulang)        |

**Validation Rules:**

| Field      | Rule                                                           |
| ---------- | -------------------------------------------------------------- |
| `role`     | Opsional; enum: `SUPER_ADMIN`, `ADMIN`, `VIEWER`               |
| `isActive` | Opsional; boolean                                              |
| `email`    | Opsional; valid email; max 255                                 |
| `password` | Opsional; min 8; max 128; mengandung huruf besar, kecil, angka |

**Success Response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "clyyy...",
    "username": "admin_panitia",
    "email": "baru@sekolah.sch.id",
    "role": "VIEWER",
    "isActive": false,
    "updatedAt": "2026-07-27T14:00:00.000Z"
  }
}
```

**Possible Error Responses:**

| HTTP Status | Error Code               | Kondisi                                              |
| ----------- | ------------------------ | ---------------------------------------------------- |
| 400         | `VALIDATION_ERROR`       | Field tidak valid atau tidak ada field yang dikirim  |
| 404         | `ADMIN_NOT_FOUND`        | Admin tidak ditemukan                                |
| 409         | `ADMIN_EMAIL_TAKEN`      | Email baru sudah digunakan                           |
| 422         | `CANNOT_DEACTIVATE_SELF` | SUPER_ADMIN tidak bisa menonaktifkan dirinya sendiri |
| 401         | `UNAUTHORIZED`           | Tidak terautentikasi                                 |
| 403         | `FORBIDDEN`              | Bukan `SUPER_ADMIN`                                  |

**Business Rules:**

1. Seorang SUPER_ADMIN tidak dapat menonaktifkan (`isActive: false`) akun dirinya sendiri.
2. Jika `password` dikirim, password di-hash ulang dengan Argon2id sebelum disimpan.
3. Jika admin di-deactivate (`isActive: false`), session mereka yang aktif tetap valid sampai expire (JWT stateless). Ini adalah trade-off desain yang diterima untuk v1.

**Audit Logging:** `ADMIN_UPDATED` atau `ADMIN_DEACTIVATED` dengan `metadata: { changedFields: ["role", "isActive"] }`.

**PRD Reference:** §1.2, §1.3
**DB Tables:** `Admin`, `AuditLog`

---

## Health API

---

### H-01 — Health Check

**`GET /api/health`**

**Purpose:** Mengecek status operasional aplikasi dan semua dependensinya. Digunakan oleh deployment platform, load balancer, dan monitoring tool.

**Authentication:** None (public endpoint).

**Authorization:** N/A.

**Rate Limiting:** Tidak ada rate limit khusus — health check harus selalu bisa dijawab.

---

**Success Response — `200 OK` (semua sistem berjalan normal):**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-27T15:30:00.000Z",
    "version": "1.0.0",
    "uptime": 3600,
    "checks": {
      "database": "ok",
      "storage": "ok"
    }
  }
}
```

**Degraded Response — `503 Service Unavailable` (ada sistem yang gagal):**

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Salah satu layanan tidak tersedia.",
    "details": {
      "status": "degraded",
      "checks": {
        "database": "error: connection timeout after 5000ms",
        "storage": "ok"
      }
    }
  }
}
```

**Business Rules:**

1. `database`: jalankan `SELECT 1` via Prisma. Timeout 5 detik.
2. `storage`: lakukan lightweight HEAD request ke storage bucket. Timeout 3 detik.
3. `version`: dibaca dari konfigurasi aplikasi (package.json version via env).
4. `uptime`: dalam detik sejak proses Node.js dimulai.
5. Jika **semua** checks OK → HTTP 200 + `status: "ok"`.
6. Jika **ada** check yang gagal → HTTP 503 + `status: "degraded"`.
7. Endpoint ini tidak mengembalikan informasi sensitif (tidak ada DB credentials, tidak ada internal paths).

**PRD Reference:** N/A (operational requirement)
**DB Tables:** Tidak ada (hanya lightweight connectivity test)

---

## API Security Notes

### Token Anonymity

Semua endpoint yang berkaitan dengan voting **wajib** mempertahankan jaminan anonimitas berikut:

| Jaminan                                   | Implementasi                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Token plaintext tidak disimpan            | HMAC-SHA256 hash saja yang tersimpan di DB                              |
| Token ↔ Kandidat tidak bisa dikorelasikan | Tidak ada FK `VotingToken → Vote` di skema DB                           |
| Vote tidak mengandung identitas           | `Vote` record hanya punya `candidate_id`, `election_id`, `voted_at`     |
| Response vote tidak bocorkan data         | `/api/vote/cast` response tidak mengandung kandidat atau token info     |
| Audit log vote tidak bocorkan data        | `VOTE_CAST` audit entry tidak mengandung `candidate_id` atau `token_id` |

### Defense in Depth

Validasi dilakukan di **tiga layer**:

```
Layer 1 — Route Handler:   Zod schema validation (format, type, range)
Layer 2 — Service Layer:   Business logic validation (state machine, permission, existence check)
Layer 3 — Database:        Constraint enforcement (UNIQUE, CHECK, FK, partial unique index)
```

Jika validasi di layer 1 gagal → 400 Validation Error.
Jika validasi di layer 2 gagal → 4xx sesuai jenis error.
Jika constraint database gagal → 409 atau 500 tergantung jenis error.

### Secret Management

| Secret                      | Lokasi          | Ekspos ke Browser?               |
| --------------------------- | --------------- | -------------------------------- |
| `TOKEN_HMAC_SECRET`         | Server env only | ❌ Tidak pernah                  |
| `AUTH_SECRET`               | Server env only | ❌ Tidak pernah                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Server env only | ❌ **Tidak pernah** _(PRD §9.2)_ |
| `DATABASE_URL`              | Server env only | ❌ Tidak pernah                  |

### CSRF Protection

- Semua mutating endpoint admin (`POST`, `PATCH`, `DELETE`) dilindungi CSRF token dari Auth.js.
- CSRF token disertakan oleh Auth.js client library secara otomatis.
- Voting endpoints (`/api/vote/*`) tidak memerlukan CSRF karena tidak menggunakan cookie session.

---

## Error Catalogue

| Code                           | HTTP | Kategori   | Deskripsi                                      |
| ------------------------------ | ---- | ---------- | ---------------------------------------------- |
| `VALIDATION_ERROR`             | 400  | Input      | Gagal validasi format/type/range               |
| `TOKEN_INVALID`                | 400  | Voting     | Token tidak ditemukan atau sudah dipakai       |
| `TOKEN_ALREADY_USED`           | 409  | Voting     | Race condition: token baru saja dipakai        |
| `ELECTION_NOT_OPEN`            | 422  | Voting     | Election tidak dalam state OPEN                |
| `ELECTION_NOT_FOUND`           | 404  | Election   | Election ID tidak ada                          |
| `ELECTION_WRONG_STATE`         | 422  | Election   | Operasi tidak valid untuk state ini            |
| `ELECTION_TRANSITION_INVALID`  | 422  | Election   | Transisi state tidak diizinkan                 |
| `ELECTION_MIN_CANDIDATES`      | 422  | Election   | Kurang dari 2 kandidat                         |
| `ELECTION_MAX_CANDIDATES`      | 422  | Election   | Sudah 5 kandidat (maksimum)                    |
| `ACTIVE_ELECTION_EXISTS`       | 422  | Election   | Sudah ada election aktif                       |
| `CANDIDATE_NOT_FOUND`          | 404  | Candidate  | Kandidat ID tidak ada                          |
| `CANDIDATE_NOT_IN_ELECTION`    | 422  | Candidate  | Kandidat bukan bagian dari election ini        |
| `CANDIDATE_HAS_VOTES`          | 409  | Candidate  | Kandidat sudah punya suara, tidak bisa dihapus |
| `ORDER_NUMBER_TAKEN`           | 409  | Candidate  | Nomor urut sudah dipakai                       |
| `TOKEN_GENERATION_ACTIVE_ONLY` | 422  | Token      | Token hanya bisa di-generate saat SETUP        |
| `PHOTO_UPLOAD_FAILED`          | 500  | Storage    | Storage service error saat upload              |
| `INVALID_FILE_TYPE`            | 400  | Storage    | Tipe file tidak didukung                       |
| `FILE_TOO_LARGE`               | 400  | Storage    | File melebihi batas ukuran                     |
| `ADMIN_USERNAME_TAKEN`         | 409  | Admin      | Username sudah digunakan                       |
| `ADMIN_EMAIL_TAKEN`            | 409  | Admin      | Email sudah digunakan                          |
| `ADMIN_NOT_FOUND`              | 404  | Admin      | Admin ID tidak ada                             |
| `CANNOT_DEACTIVATE_SELF`       | 422  | Admin      | Tidak bisa menonaktifkan diri sendiri          |
| `UNAUTHORIZED`                 | 401  | Auth       | Tidak terautentikasi                           |
| `FORBIDDEN`                    | 403  | Auth       | Role tidak memiliki akses                      |
| `NOT_FOUND`                    | 404  | General    | Resource tidak ditemukan                       |
| `RATE_LIMIT_EXCEEDED`          | 429  | Rate Limit | Terlalu banyak request                         |
| `INTERNAL_ERROR`               | 500  | Server     | Error internal server                          |
| `SERVICE_UNAVAILABLE`          | 503  | Health     | Layanan tidak tersedia                         |

---

## Future API Evolution

### v2 Candidates

Endpoint berikut diidentifikasi sebagai kandidat untuk v2 berdasarkan PRD §Future Improvements. **Tidak boleh diimplementasikan di v1.**

| Endpoint (Kandidat v2)                           | Tujuan                             | PRD Ref |
| ------------------------------------------------ | ---------------------------------- | ------- |
| `GET /api/v2/elections`                          | Multi-election support             | PRD v2  |
| `POST /api/admin/tokens/export-pdf`              | Export token sebagai PDF           | PRD v2  |
| `GET /api/public/results/[electionId]`           | Public result page pasca election  | PRD v2  |
| `GET /api/admin/results/export-excel`            | Export hasil ke Excel              | PRD v2  |
| `GET /api/admin/elections/[id]/verify-integrity` | Verifikasi hash chain (v2 feature) | PRD v2  |

### Backward Compatibility

- Perubahan breaking terhadap response schema memerlukan versi baru (`/api/v2/...`).
- Penambahan field baru dalam response dianggap non-breaking (additive).
- Penghapusan field atau perubahan type adalah breaking change.

---

## Review Notes

> Bagian ini mencatat hal-hal yang memerlukan klarifikasi atau keputusan sebelum implementasi. Tidak ada perubahan requirement yang dilakukan di sini.

### RN-01 — Token Export Endpoint (T-02)

**Konflik yang diidentifikasi:**

- PRD §3 menyatakan: "Token disimpan di database dalam bentuk HMAC-SHA256 hash, bukan plaintext."
- Arch §02 menyebutkan `GET /api/admin/tokens/export` untuk export CSV token.
- Database Design tidak menyimpan plaintext, hanya `token_hash`.

**Konsekuensi:** Endpoint `GET /api/admin/tokens/export` tidak dapat mengembalikan token plaintext karena plaintext tidak tersimpan di database.

**Solusi yang direkomendasikan (perlu persetujuan):**

Opsi A: Hapus `GET /api/admin/tokens/export` — frontend meng-handle export langsung dari response `POST /api/admin/tokens/generate`.

Opsi B: Tambahkan kolom `token_plaintext_encrypted` di tabel `VotingToken` yang dienkripsi dengan server key, sehingga bisa di-decrypt untuk export. Ini memerlukan revisi Database Design.

Opsi C: Pertahankan endpoint `/export` tapi hanya export metadata (nomor urut, timestamp, status used/unused) tanpa plaintext token — sudah diimplementasikan seperti ini di spesifikasi T-02.

**Status:** Menunggu keputusan. Saat ini T-02 menggunakan Opsi C sebagai default konservatif.

---

### RN-02 — Candidate Photo Upload Sequence

**Catatan:** Endpoint C-02 (Create Candidate) memperbolehkan kandidat dibuat tanpa foto (`photoUrl: null`). Foto diupload terpisah via C-05. Ini berarti ada window waktu di mana kandidat tampil di sistem tanpa foto.

**Pertanyaan:** Apakah kandidat tanpa foto harus diblokir dari transisi `SETUP → READY`? Atau frontend harus enforce bahwa foto wajib sebelum bisa submit?

**Status:** Menunggu klarifikasi. Saat ini tidak ada business rule yang memblokir transisi jika ada kandidat tanpa foto.

---

### RN-03 — Admin Login Lockout Policy

PRD menyebutkan "lockout setelah N kali gagal" tapi nilai N tidak ditentukan.

**Rekomendasi:** Lockout setelah **5 kali gagal** dalam 15 menit. Lockout duration: 30 menit. Ini selaras dengan rate limit `POST /api/auth/signin`: 5 req / 15 menit.

**Status:** Menunggu konfirmasi nilai N dari Product Manager.

---

> **Dokumen ini adalah API Contract yang hidup.** Setiap perubahan ke endpoint yang sudah ada harus diverifikasi konsistensinya dengan PRD, Database Design, dan System Architecture sebelum diimplementasikan. Lihat Review Notes untuk item yang masih menunggu keputusan.
