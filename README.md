# SILAKHADIR

**Sistem Informasi Layanan Absensi Kegiatan dan Sertifikat Digital**

Aplikasi web untuk mengelola kegiatan, absensi online peserta, pengecekan status sertifikat berdasarkan NIK/NIP, dan download sertifikat digital secara mandiri.

## Stack Teknologi

- **Backend**: Django 5 + Django REST Framework
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: PostgreSQL (default) atau MySQL
- **Authentication**: JWT (SimpleJWT)
- **Sertifikat**: Generate PDF otomatis (ReportLab)
- **QR Code**: Verifikasi keaslian sertifikat

## Struktur Project

```
silakhadir/
├── backend/          # Django + DRF
└── frontend/         # React + Vite
```

## Panduan Instalasi

### 1. Backend (Django)

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Konfigurasi database di config/settings.py atau .env
# Default: SQLite (development). Untuk produksi gunakan PostgreSQL/MySQL.

python manage.py makemigrations
python manage.py migrate
python manage.py seed_data        # seed data contoh
python manage.py createsuperuser  # opsional, sudah ada admin via seed

python manage.py runserver
```

Backend berjalan di `http://localhost:8000`.

Akun default hasil seed:
- Super Admin: `superadmin` / `admin123`
- Admin Kegiatan: `admin` / `admin123`
- Operator: `operator` / `admin123`

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di `http://localhost:5173`.

## Alur Penggunaan

**Admin:**
1. Login ke dashboard
2. Buat kegiatan baru
3. Bagikan link/QR absensi kepada peserta
4. Pantau kehadiran peserta
5. Tutup kegiatan saat selesai
6. Generate sertifikat untuk peserta hadir

**Peserta:**
1. Buka link absensi dari admin
2. Isi NIK/NIP dan data diri
3. Tunggu kegiatan selesai
4. Cek sertifikat di halaman publik via NIK/NIP
5. Download PDF sertifikat
6. QR code pada sertifikat dapat diverifikasi publik

## Fitur Keamanan

- JWT authentication dengan refresh token
- Validasi input di backend dan frontend
- CORS configuration
- Throttling/rate limiting pada endpoint publik
- Cegah absensi ganda (unique per event + identity_number)
- Download sertifikat via token unik
- Verifikasi sertifikat via token unik (QR code)
- Permission berbasis role (superadmin, admin, operator)

## Lisensi

Proprietary - Instansi Pemerintahan.
