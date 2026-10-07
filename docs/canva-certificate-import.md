# Sertifikat final Canva dan absensi Excel

## Kontrak produk

- Admin membuat desain, nama, nomor, barcode, dan tanda tangan di Canva.
- Silakhadir menerima PDF final tanpa menambahkan overlay apapun.
- Absensi publik atau import Excel tidak membuat sertifikat otomatis.
- Sertifikat hanya dibagikan ke peserta kegiatan dengan status hadir.
- Sertifikat lama tidak dihapus oleh perubahan alur; pergantian membutuhkan persetujuan admin.

## Upload sertifikat

1. Buka kegiatan, tab Sertifikat.
2. Pilih PDF gabungan atau banyak PDF yang sudah dipisahkan.
3. Untuk gabungan, tentukan halaman per peserta. Untuk jumlah halaman campuran,
   gunakan rentang halaman, misalnya `1-2, 3, 4-5`.
4. Lakukan pratinjau, periksa pembagian dan pencocokan peserta.
5. Nama yang ambigu atau tidak terbaca harus dipilih secara manual. Tidak ada
   pencocokan fuzzy yang langsung mempublikasikan sertifikat tanpa review.
6. Pilih peserta tujuan tiap file, koreksi nomor jika diperlukan, dan terapkan.
7. Sertifikat yang sudah ada tidak diganti kecuali opsi penggantian disetujui.

Ekstraksi otomatis mengandalkan teks PDF. Ekspor Canva yang meratakan teks
menjadi gambar tidak dapat dicocokkan otomatis oleh ekstraktor teks; admin
harus memilih peserta. Sistem tidak mengklaim OCR atau AI yang tidak tersedia.
Pemisahan PDF mempertahankan tampilan, tetapi dapat membatalkan tanda tangan
kriptografis pada PDF bertanda tangan digital. Gunakan PDF Canva dengan tanda
tangan visual; ini bukan layanan TTE tersertifikasi.

## Absensi XLSX

- Unduh format Excel dari kegiatan.
- Isi kolom NIK, NIP, Nama Lengkap, Instansi, Jabatan, No HP, Email, Status.
- NIK/NIP/No HP harus disimpan sebagai teks untuk menghindari pembulatan digit.
- NIK wajib 16 digit; NIP opsional 18 digit.
- Status: `hadir` atau `tidak_hadir`.
- Unggah `.xlsx`, periksa hasil validasi, lalu konfirmasi import.
- Data diidentifikasi berdasarkan NIK dalam kegiatan yang sama agar import
  ulang tidak membuat absensi ganda.
- Tombol Ekspor menyediakan absensi kegiatan sebagai `.xlsx`, bukan CSV.

## Verifikasi pengembang

```sh
python manage.py test apps.certificates apps.attendance --settings=config.settings_test --noinput
node --test frontend/src/utils/importWorkflow.test.mjs
```

Pengujian menggunakan SQLite dan direktori media sementara, bukan database
produksi. Build Docker backend dan frontend secara berurutan karena server
berbagi resource dengan aplikasi lain.
