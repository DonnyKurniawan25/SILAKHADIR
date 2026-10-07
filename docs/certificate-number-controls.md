# Thumbnail utuh dan nomor sertifikat final

## Halaman publik
- Hasil Cek Sertifikat hanya menawarkan unduhan PDF, tanpa tombol Cek keaslian.
- Status verifikasi dan route verifikasi yang sudah ada tetap berfungsi; ini bukan pembatalan verifikasi.
- Thumbnail memakai alur gambar normal dan `object-contain`, bukan crop `object-cover`. Gambar lebar maupun tegak tampil utuh; ruang kosong di sekitar gambar boleh ada.

## Nomor saat impor PDF final
Detail Kegiatan → Impor PDF Final Canva → pratinjau/review:
- Deteksi tulisan `No:`/`No.`/`Nomor Sertifikat` untuk mengisi nomor pada setiap baris, bila teks PDF bisa dibaca dengan jelas.
- Pilih nomor berbeda per peserta atau isi nomor yang sama dan klik Terapkan untuk seluruh baris impor.
- Nomor yang berubah membatalkan centang review baris tersebut; periksa dan konfirmasi ulang sebelum menerapkan impor.
- Nomor boleh kosong, maksimal 100 karakter; bukan NIK/NIP. Nilai ambigu, tanggal, atau nomor terlalu panjang tidak ditebak.

## Koreksi setelah impor
Detail Kegiatan → tab Sertifikat → Nomor sertifikat (metadata):
- Pilih satu sertifikat untuk menyimpan nomor berbeda, atau pilih mode nomor sama untuk SEMUA sertifikat kegiatan, termasuk di luar halaman tabel.
- Penimpaan semua nomor dan pengosongan nomor memerlukan konfirmasi.
- Deteksi No: dari PDF yang sudah ada hanya menghasilkan pratinjau berlabel nama peserta. Pilih kandidat untuk mengisi input, kemudian Simpan. Tidak ada penimpaan otomatis atas nomor yang sudah tersimpan.
- PDF gambar/scan, teks yang diubah menjadi outline, hasil ambigu, atau berkas yang melewati batas pemrosesan aman dapat memerlukan input manual. Tidak ada janji OCR universal.
- Endpoint dibatasi admin/superadmin dan sertifikat dibatasi ke kegiatan pada URL; mode semua tidak mengikuti filter/paginasi tabel.

## Integritas
Perubahan nomor setelah impor hanya mengubah metadata database. Byte berkas PDF final, path file, tanda tangan, QR/token, dan status verifikasi tidak berubah. Untuk menambahkan/mengubah tulisan nomor di dalam PDF, revisi dokumen sumber di Canva dan unggah final yang benar melalui alur impor; tidak menempel overlay di atas sertifikat final.

## Verifikasi rilis
- 93 tes backend terkait sertifikat, thumbnail, dan lifecycle serta 71 tes frontend lulus.
- QA API website aktif membuktikan nomor bersama/per peserta, otorisasi/validasi, deteksi berlabel nama peserta, metadata publik, dan SHA256 PDF asli yang tidak berubah.
- QA browser website aktif membuktikan thumbnail utuh di desktop/ponsel tanpa overflow, tombol Cek keaslian tidak ada, deteksi → pilih kandidat → simpan, konfirmasi nomor bersama, dan nomor otomatis/shared pada pratinjau impor; tanpa exception aplikasi.
- Fixture kegiatan, peserta, sertifikat, dan batch impor dihapus; 3 berkas publik dan 1 berkas pratinjau privat dibersihkan. Tujuh referensi media produksi dan metadata sertifikat produksi tetap utuh.
