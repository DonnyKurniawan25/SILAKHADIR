# Kompres ALL Sertifikat

Detail Kegiatan → Sertifikat → Kompres ALL Sertifikat (admin/superadmin).

- Memerlukan konfirmasi dan memproses snapshot seluruh sertifikat kegiatan, bukan hanya baris halaman tabel yang tampil.
- Proses otomatis berjalan satu PDF per langkah dengan progres dan hasil per peserta. Jika permintaan terputus, gunakan Lanjutkan kompresi untuk pekerjaan yang masih ada di layar. Jangan menutup halaman selama proses.
- Target <1.000.000 byte. Hasil yang lebih kecil dari sumber dan <2.000.000 byte dapat diterima. Ukuran tepat 2.000.000 byte tidak diterima sebagai pengganti.
- Kompresi menggunakan qpdf lossless: stream/object compression, tanpa rasterisasi halaman, downsampling/re-encode foto, pengubahan teks, atau overlay. Nomor sertifikat, QR/token, sumber dan status verifikasi database tidak diubah.
- PDF dengan tanda tangan digital kriptografis tidak ditulis ulang. Tanda tangan visual yang merupakan bagian desain Canva tetap dipertahankan oleh kompresi lossless.
- PDF terenkripsi, berbahaya/tidak didukung, melewati batas sumber daya, hilang, atau yang tidak bisa diperkecil secara aman dilaporkan dan tidak dipaksa. Berkas asli ≥2 MB dapat tetap ≥2 MB; hasil memperingatkan perlunya penanganan manual, bukan mengklaim sukses memenuhi ukuran.
- Penggantian memakai nama file baru yang unik. File lama dibersihkan setelah commit hanya bila tidak direferensikan record lain; kegagalan tidak boleh menghapus sumber asli.
- Kompresi ini tindakan eksplisit. Alur unggah/import PDF final biasa tetap mempertahankan dokumen sesuai kontrak sebelumnya; tidak otomatis memampatkan semua dokumen produksi.

## Keamanan proses

Pekerjaan tersimpan di database, dibatasi pemilik/kegiatan. Snapshot tidak memasukkan impor baru yang muncul setelah pekerjaan dimulai. Langkah yang sudah selesai tidak diproses lagi. Kompresor diserialkan lintas worker dengan lock filesystem; subprocess memiliki batas waktu, CPU, memori dan ukuran output. Tidak memakai `preexec_fn` di worker Gunicorn multithread.
