# Contributing to SILAKHADIR

Terima kasih atas minat Anda untuk berkontribusi pada SILAKHADIR! 🎉

## 📋 Cara Berkontribusi

### 1. Fork Repository
Fork repository ini ke akun GitHub Anda.

### 2. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/SILAKHADIR.git
cd SILAKHADIR
```

### 3. Buat Branch Baru
```bash
git checkout -b feature/nama-fitur-anda
# atau
git checkout -b fix/nama-bug-yang-diperbaiki
```

### 4. Setup Development Environment
Ikuti panduan di [`PANDUAN.md`](PANDUAN.md) untuk setup backend dan frontend.

### 5. Buat Perubahan
- Tulis kode yang bersih dan mudah dipahami
- Ikuti style guide yang ada
- Tambahkan komentar jika diperlukan
- Pastikan kode Anda tidak merusak fitur yang sudah ada

### 6. Test Perubahan Anda
```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm run build
```

### 7. Commit Perubahan
```bash
git add .
git commit -m "feat: menambahkan fitur X"
# atau
git commit -m "fix: memperbaiki bug Y"
```

**Format Commit Message:**
- `feat:` untuk fitur baru
- `fix:` untuk perbaikan bug
- `docs:` untuk perubahan dokumentasi
- `style:` untuk perubahan formatting
- `refactor:` untuk refactoring kode
- `test:` untuk menambah test
- `chore:` untuk maintenance

### 8. Push ke GitHub
```bash
git push origin feature/nama-fitur-anda
```

### 9. Buat Pull Request
- Buka repository Anda di GitHub
- Klik "New Pull Request"
- Pilih branch Anda
- Isi deskripsi PR dengan jelas:
  - Apa yang diubah?
  - Mengapa perubahan ini diperlukan?
  - Bagaimana cara testing?
  - Screenshot (jika ada perubahan UI)

## 🎯 Area Kontribusi

### Backend (Django)
- Menambah fitur baru di apps
- Memperbaiki bug
- Meningkatkan performa query
- Menambah test coverage
- Memperbaiki security issues

### Frontend (React)
- Menambah komponen baru
- Memperbaiki UI/UX
- Meningkatkan responsiveness
- Menambah fitur interaktif
- Memperbaiki accessibility

### Dokumentasi
- Memperbaiki typo
- Menambah contoh penggunaan
- Menerjemahkan dokumentasi
- Membuat tutorial
- Menambah FAQ

### Testing
- Menambah unit test
- Menambah integration test
- Menambah end-to-end test
- Memperbaiki test yang gagal

## 📝 Style Guide

### Python (Backend)
- Ikuti [PEP 8](https://pep8.org/)
- Gunakan type hints jika memungkinkan
- Maksimal 88 karakter per baris (Black formatter)
- Gunakan docstring untuk function/class

```python
def generate_certificate(event_id: str, participant_id: str) -> Certificate:
    """
    Generate certificate untuk peserta kegiatan.
    
    Args:
        event_id: UUID kegiatan
        participant_id: UUID peserta
        
    Returns:
        Certificate object yang sudah di-generate
        
    Raises:
        ValidationError: Jika data tidak valid
    """
    pass
```

### JavaScript/React (Frontend)
- Gunakan ES6+ syntax
- Prefer functional components dengan hooks
- Gunakan PropTypes atau TypeScript
- Maksimal 100 karakter per baris
- Gunakan meaningful variable names

```jsx
// ✅ Good
const CertificateCard = ({ certificate, onDownload }) => {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleDownload = async () => {
    setIsLoading(true)
    await onDownload(certificate.id)
    setIsLoading(false)
  }
  
  return (
    <div className="certificate-card">
      {/* ... */}
    </div>
  )
}

// ❌ Bad
const Card = ({ c, d }) => {
  const [l, setL] = useState(false)
  // ...
}
```

### CSS/Tailwind
- Gunakan Tailwind utility classes
- Hindari inline styles kecuali dynamic values
- Gunakan responsive classes (sm:, md:, lg:)
- Group related classes

```jsx
// ✅ Good
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">

// ❌ Bad
<div className="flex p-4 bg-white items-center rounded-lg justify-between shadow-md hover:shadow-lg transition-shadow">
```

## 🐛 Melaporkan Bug

Gunakan [GitHub Issues](https://github.com/DonnyKurniawan25/SILAKHADIR/issues) dengan template:

```markdown
**Deskripsi Bug:**
Jelaskan bug yang terjadi dengan jelas.

**Langkah Reproduksi:**
1. Buka halaman X
2. Klik tombol Y
3. Lihat error Z

**Expected Behavior:**
Apa yang seharusnya terjadi?

**Actual Behavior:**
Apa yang sebenarnya terjadi?

**Screenshots:**
Jika ada, tambahkan screenshot.

**Environment:**
- OS: Windows 11
- Browser: Chrome 120
- Python: 3.11
- Node: 18.17
```

## 💡 Mengusulkan Fitur

Gunakan [GitHub Issues](https://github.com/DonnyKurniawan25/SILAKHADIR/issues) dengan label `enhancement`:

```markdown
**Fitur yang Diusulkan:**
Jelaskan fitur yang ingin ditambahkan.

**Masalah yang Diselesaikan:**
Masalah apa yang akan diselesaikan oleh fitur ini?

**Solusi yang Diusulkan:**
Bagaimana cara implementasinya?

**Alternatif:**
Apakah ada alternatif lain yang sudah dipertimbangkan?

**Mockup/Wireframe:**
Jika ada, tambahkan mockup atau wireframe.
```

## ✅ Checklist Pull Request

Sebelum submit PR, pastikan:

- [ ] Kode sudah di-test dan berjalan dengan baik
- [ ] Tidak ada console.log atau print statement yang tidak perlu
- [ ] Dokumentasi sudah diupdate (jika perlu)
- [ ] Commit message mengikuti format yang benar
- [ ] Tidak ada conflict dengan branch main
- [ ] Code review sudah dilakukan sendiri
- [ ] Screenshot ditambahkan (untuk perubahan UI)

## 🔍 Code Review Process

1. **Automated Checks:** GitHub Actions akan menjalankan test otomatis
2. **Manual Review:** Maintainer akan review kode Anda
3. **Feedback:** Anda mungkin diminta untuk melakukan perubahan
4. **Approval:** Setelah approved, PR akan di-merge
5. **Deployment:** Perubahan akan masuk ke production

## 📞 Butuh Bantuan?

- **GitHub Issues:** Untuk bug report dan feature request
- **GitHub Discussions:** Untuk diskusi umum
- **Email:** donyacm25@gmail.com

## 🙏 Terima Kasih!

Setiap kontribusi, sekecil apapun, sangat berarti untuk project ini. Terima kasih telah membantu membuat SILAKHADIR lebih baik! 🚀

---

**Happy Contributing!** 🎉