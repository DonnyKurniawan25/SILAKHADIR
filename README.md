# 🎓 SILAKHADIR

**Sistem Informasi Layanan Kehadiran dan Sertifikat Digital**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.0+-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> Solusi open source untuk manajemen kehadiran dan penerbitan sertifikat digital yang efisien, aman, dan mudah digunakan.

---

## 📋 Daftar Isi

- [Tentang SILAKHADIR](#-tentang-silakhadir)
- [Fitur Utama](#-fitur-utama)
- [Demo](#-demo)
- [Teknologi](#-teknologi)
- [Instalasi](#-instalasi)
- [Penggunaan](#-penggunaan)
- [API Documentation](#-api-documentation)
- [Roadmap](#-roadmap)
- [Kontribusi](#-kontribusi)
- [Lisensi](#-lisensi)
- [Kontak](#-kontak)

---

## 🎯 Tentang SILAKHADIR

SILAKHADIR adalah sistem manajemen kehadiran dan sertifikat digital yang dirancang untuk membantu instansi pemerintah, organisasi, dan lembaga pendidikan dalam mengelola kegiatan secara efisien dan terdigitalisasi.

### Masalah yang Diselesaikan

- ❌ **Proses manual** yang memakan waktu untuk absensi dan penerbitan sertifikat
- ❌ **Kesulitan verifikasi** keaslian sertifikat
- ❌ **Data tersebar** dan sulit dikelola
- ❌ **Biaya tinggi** untuk pencetakan dan distribusi sertifikat fisik
- ❌ **Tidak ada tracking** dan analytics untuk kegiatan

### Solusi SILAKHADIR

- ✅ **Absensi online** dengan QR code dan link publik
- ✅ **Sertifikat digital** dengan verifikasi QR code
- ✅ **Dashboard analytics** untuk monitoring real-time
- ✅ **Export/import** data dengan mudah
- ✅ **Multi-role access** untuk keamanan data
- ✅ **Responsive design** untuk akses dari berbagai device

---

## ✨ Fitur Utama

### 1. 📅 Manajemen Kegiatan
- Buat, edit, dan kelola kegiatan dengan mudah
- Set jadwal, lokasi, dan penyelenggara
- Status kegiatan (Draft, Open, Closed, Done)
- Template sertifikat per kegiatan

### 2. ✍️ Absensi Online
- Link absensi publik yang dapat dibagikan
- QR code untuk scan cepat
- Form absensi dengan validasi data
- Captcha untuk keamanan
- Real-time attendance tracking

### 3. 🏆 Sertifikat Digital
- Generate sertifikat PDF otomatis
- QR code untuk verifikasi keaslian
- Nomor sertifikat unik dan terstruktur
- Download sertifikat dengan token aman
- Bulk certificate generation

### 4. 🔍 Verifikasi Sertifikat
- Cek sertifikat dengan NIK/NIP
- Scan QR code untuk verifikasi instant
- Public verification page
- Certificate authenticity guarantee

### 5. 👥 Manajemen Peserta
- CRUD peserta kegiatan
- Import data dari Excel
- Export data ke Excel
- Bulk operations
- Search dan filter

### 6. 📊 Laporan & Analytics
- Dashboard dengan statistik real-time
- Rekap kehadiran per kegiatan
- Export laporan (Excel, PDF)
- Charts dan visualisasi data
- Event report dengan cover image

### 7. 🔐 Keamanan & Akses
- JWT authentication
- Multi-role (Super Admin, Admin, Operator)
- Permission-based access control
- Token-based file download
- CORS configuration

### 8. ⚙️ Pengaturan Aplikasi
- Branding customization (logo, nama, warna)
- Certificate number format
- Email & contact settings
- Public/private settings toggle

---

## 🎬 Demo

### Screenshots

#### Landing Page
![Landing Page](docs/screenshots/landing.png)

#### Dashboard Admin
![Dashboard](docs/screenshots/dashboard.png)

#### Absensi Online
![Attendance Form](docs/screenshots/attendance.png)

#### Sertifikat Digital
![Certificate](docs/screenshots/certificate.png)

### Live Demo
🔗 **Coming Soon**

### Video Tutorial
📹 **Coming Soon**

---

## 🛠️ Teknologi

### Backend
- **Framework:** Django 5.0.6
- **API:** Django REST Framework 3.15.1
- **Authentication:** JWT (djangorestframework-simplejwt)
- **Database:** PostgreSQL / MySQL / SQLite
- **PDF Generation:** ReportLab, xhtml2pdf
- **QR Code:** qrcode library
- **Excel:** openpyxl, pandas

### Frontend
- **Framework:** React 18.3.1
- **Build Tool:** Vite 5.3.1
- **Styling:** Tailwind CSS 3.4.4
- **HTTP Client:** Axios
- **Routing:** React Router DOM 6.24.0
- **Forms:** React Hook Form 7.52.0
- **Charts:** Recharts 2.12.7
- **Rich Text:** CKEditor 5

### DevOps
- **Version Control:** Git
- **Package Manager:** pip (Python), npm (Node.js)
- **Environment:** python-decouple

---

## 🚀 Instalasi

### Prasyarat
- Python 3.10+
- Node.js 18+
- PostgreSQL 13+ atau MySQL 8+ (opsional, default SQLite)

### Quick Start

#### 1. Clone Repository
```bash
git clone https://github.com/DonnyKurniawan25/SILAKHADIR.git
cd SILAKHADIR
```

#### 2. Setup Backend
```bash
cd backend

# Virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Environment configuration (optional)
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# Database migration
python manage.py migrate

# Load sample data
python manage.py seed_data

# Run server
python manage.py runserver
```

Backend akan berjalan di: `http://localhost:8000`

**Akun Demo:**
| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `admin123` |
| Admin | `admin` | `admin123` |
| Operator | `operator` | `admin123` |

#### 3. Setup Frontend
```bash
cd frontend

# Install dependencies
npm install

# Environment configuration (optional)
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# Run development server
npm run dev
```

Frontend akan berjalan di: `http://localhost:5173`

### Instalasi Detail
Lihat [`PANDUAN.md`](PANDUAN.md) untuk panduan instalasi lengkap.

---

## 📖 Penggunaan

### Alur Kerja Umum

1. **Login sebagai Admin**
   - Buka `http://localhost:5173/login`
   - Login dengan akun admin

2. **Buat Kegiatan Baru**
   - Navigasi ke menu "Kegiatan"
   - Klik "Tambah Kegiatan"
   - Isi form (judul, jadwal, lokasi, dll)
   - Simpan kegiatan

3. **Bagikan Link Absensi**
   - Buka detail kegiatan
   - Copy link absensi atau download QR code
   - Bagikan ke peserta

4. **Peserta Mengisi Absensi**
   - Peserta buka link absensi
   - Isi form dengan data diri
   - Submit absensi

5. **Generate Sertifikat**
   - Setelah kegiatan selesai
   - Klik "Generate Sertifikat"
   - Sistem akan membuat PDF untuk semua peserta

6. **Peserta Download Sertifikat**
   - Peserta buka `/cek-sertifikat`
   - Masukkan NIK/NIP
   - Download sertifikat PDF

7. **Verifikasi Sertifikat**
   - Scan QR code di sertifikat
   - Atau buka link verifikasi manual
   - Sistem akan menampilkan detail sertifikat

---

## 📚 API Documentation

### Authentication

#### Login
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

Response:
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Events

#### List Events
```http
GET /api/events/
Authorization: Bearer {access_token}
```

#### Create Event
```http
POST /api/events/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Workshop React",
  "start_date": "2026-06-15T09:00:00Z",
  "end_date": "2026-06-15T16:00:00Z",
  "location": "Aula Utama",
  "organizer": "IT Department"
}
```

### Public Endpoints

#### Submit Attendance
```http
POST /api/public/events/{slug}/attendance/
Content-Type: application/json

{
  "identity_type": "nik",
  "identity_number": "1234567890123456",
  "full_name": "John Doe",
  "institution": "Company ABC",
  "position": "Developer",
  "phone": "081234567890",
  "email": "john@example.com"
}
```

#### Check Certificate
```http
GET /api/public/certificates/check/?identity_number=1234567890123456
```

Lihat [`PANDUAN.md`](PANDUAN.md) untuk dokumentasi API lengkap.

---

## 🗺️ Roadmap

### Q3 2026
- [ ] AI-powered certificate generator
- [ ] WhatsApp & Email notifications
- [ ] Multi-tenant support
- [ ] Advanced analytics

### Q4 2026
- [ ] Mobile app (React Native)
- [ ] SIMPEG/SISDM integration
- [ ] Payment gateway
- [ ] Certificate marketplace

### 2027
- [ ] Machine learning predictions
- [ ] Blockchain verification
- [ ] API marketplace
- [ ] Enterprise features

Lihat [`ROADMAP.md`](ROADMAP.md) untuk roadmap lengkap.

---

## 🤝 Kontribusi

Kami sangat menghargai kontribusi dari komunitas! 

### Cara Berkontribusi
1. Fork repository ini
2. Buat branch fitur (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md) untuk panduan lengkap.

### Contributors
Terima kasih kepada semua kontributor! 🙏

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## 📄 Lisensi

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

## 📞 Kontak

**Donny Kurniawan**
- GitHub: [@DonnyKurniawan25](https://github.com/DonnyKurniawan25)
- Email: donyacm25@gmail.com

**Project Link:** [https://github.com/DonnyKurniawan25/SILAKHADIR](https://github.com/DonnyKurniawan25/SILAKHADIR)

---

## 🙏 Acknowledgments

- [Django](https://www.djangoproject.com/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ReportLab](https://www.reportlab.com/)
- Semua kontributor open source

---

## ⭐ Star History

Jika project ini bermanfaat, berikan ⭐ untuk mendukung development!

[![Star History Chart](https://api.star-history.com/svg?repos=DonnyKurniawan25/SILAKHADIR&type=Date)](https://star-history.com/#DonnyKurniawan25/SILAKHADIR&Date)

---

<div align="center">

**Dibuat dengan ❤️ untuk komunitas open source Indonesia**

[⬆ Kembali ke atas](#-silakhadir)

</div>
