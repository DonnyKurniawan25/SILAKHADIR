# Panduan Instalasi & Menjalankan SILAKHADIR

## Prasyarat

- Python 3.10+
- Node.js 18+
- PostgreSQL 13+ atau MySQL 8+ (opsional, default SQLite)

## 1. Backend (Django + DRF)

```bash
cd backend

# Virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Dependency
pip install -r requirements.txt

# Konfigurasi env (opsional, default SQLite)
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# Migrasi & seed
python manage.py migrate
python manage.py seed_data

# Jalankan
python manage.py runserver
```

Backend: `http://localhost:8000`  
Django admin: `http://localhost:8000/admin/`

**Akun demo (password: `admin123`):**

| Role | Username |
|------|----------|
| Super Admin | `superadmin` |
| Admin Kegiatan | `admin` |
| Operator | `operator` |

### Konfigurasi Database (PostgreSQL / MySQL)

Edit file `backend/.env`:

```ini
DB_ENGINE=postgresql   # atau mysql
DB_NAME=silakhadir
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
```

Lalu jalankan ulang `python manage.py migrate`.

## 2. Frontend (React + Vite)

```bash
cd frontend

npm install

# Konfigurasi env (opsional, default ke http://localhost:8000/api)
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# Development
npm run dev

# Production build
npm run build
npm run preview
```

Frontend: `http://localhost:5173`

## 3. Testing Alur

1. **Login admin** di `http://localhost:5173/login` (admin / admin123)
2. **Buat kegiatan** baru, atau gunakan "Bimtek SPBE 2026" dari seed
3. **Salin Link Absensi** di halaman detail kegiatan
4. Buka link tersebut di tab incognito → isi form absensi
5. Kembali ke admin → klik **Generate Sertifikat** (setelah kegiatan di-close/finish)
6. Buka `/cek-sertifikat`, masukkan NIK/NIP peserta
7. **Download PDF** & **scan QR** di sertifikat → otomatis verifikasi

## 4. Endpoint Utama

| Method | URL | Auth | Deskripsi |
|--------|-----|------|-----------|
| POST | `/api/auth/login/` | - | JWT login |
| POST | `/api/auth/refresh/` | - | Refresh token |
| GET | `/api/auth/me/` | JWT | Profil user |
| GET | `/api/dashboard/stats/` | JWT | Statistik dashboard |
| GET/POST | `/api/events/` | JWT | List / buat kegiatan |
| GET/PUT/DELETE | `/api/events/{id}/` | JWT | Detail / edit / hapus |
| GET | `/api/events/{id}/attendance-link/` | JWT | URL absensi publik |
| GET/POST | `/api/events/{id}/participants/` | JWT | List / buat peserta |
| POST | `/api/events/{id}/participants/import-excel/` | JWT | Import Excel |
| GET | `/api/events/{id}/participants/export-excel/` | JWT | Export Excel |
| POST | `/api/events/{id}/certificates/generate/` | JWT | Generate semua PDF |
| GET | `/api/events/{id}/reports/attendance/` | JWT | Rekap absensi |
| GET | `/api/events/{id}/reports/export-excel/` | JWT | Export rekap Excel |
| GET | `/api/events/{id}/reports/export-pdf/` | JWT | Export rekap PDF |
| GET/PUT | `/api/settings/` | GET publik, PUT admin | App setting |
| **Public** | | | |
| GET | `/api/public/events/{slug}/info/` | - | Info kegiatan |
| POST | `/api/public/events/{slug}/attendance/` | - | Submit absensi |
| GET | `/api/public/certificates/check/?identity_number=` | - | Cek sertifikat |
| GET | `/api/public/certificates/download/{token}/` | - | Download PDF |
| GET | `/api/public/certificates/verify/{token}/` | - | Verifikasi QR |

## 5. Struktur Data Nomor Sertifikat

Format: `001/SIAKADIR/NAMA-KEGIATAN/BULAN/TAHUN`  
Contoh: `001/SIAKADIR/BIMTEK-SPBE-2026/V/2026`

Dihasilkan otomatis saat generate sertifikat.

## 6. Import Peserta (Excel)

Format kolom yang diharapkan pada baris pertama Excel:

```
identity_type | identity_number | full_name | institution | position | phone | email
```

Contoh tersedia di `backend/sample_data/peserta_template.csv`.

## 7. Troubleshooting

- **CORS error** → tambahkan URL frontend ke `CORS_ALLOWED_ORIGINS` di `.env`.
- **PDF tidak muncul foto tanda tangan** → gunakan PNG transparan, ukuran <1MB.
- **QR scan hasil error** → pastikan `FRONTEND_URL` di `.env` adalah URL yang bisa diakses peserta.
- **Migrasi gagal untuk user model** → hapus `db.sqlite3` + semua folder `migrations/xxxx_*.py` (kecuali `__init__.py`), lalu `makemigrations` ulang.
