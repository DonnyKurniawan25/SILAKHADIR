# Cek sertifikat publik dan thumbnail kegiatan

## Tujuan
- Pencarian menggunakan salah satu identitas: NIK 16 digit atau NIP 18 digit, termasuk peserta ASN yang tidak memiliki NIK di database.
- Tombol unduh mencerminkan PDF fisik yang tersedia, bukan keberadaan field `pdf_url` yang tidak dikirim serializer publik.
- Pisahkan ketersediaan PDF dari status verifikasi admin. PDF `diproses` yang ada dapat diunduh, tetapi jangan ditandai terverifikasi.
- Kartu hasil menampilkan thumbnail kegiatan utuh tanpa crop, nama kegiatan, peserta, tanggal, penyelenggara, nomor sertifikat dan unduhan. Tombol cek keaslian di hasil pencarian dihapus atas permintaan pengguna; status dan route verifikasi tidak dihapus.

## Thumbnail
Admin/superadmin dapat mengunggah foto kegiatan melalui `POST /api/events/{id}/thumbnail/` (multipart field `thumbnail`) dan tombol **Upload Foto Thumbnail Kegiatan** di detail kegiatan. Foto opsional; kegiatan lama tetap menggunakan tampilan pengganti. Validasi gambar di server: format JPEG/PNG/WebP, isi file benar, ukuran maksimal 5 MB dan dimensi maksimal 4096 × 4096 piksel.

## Kontrak publik
`GET /api/public/certificates/check/?identity=<nomor>` menerima NIK/NIP. Alias `nik`, `nip`, `identity_number` tetap didukung. Hasil menambahkan `thumbnail_url` dan `can_download`; `download_url` hanya tersedia bila PDF fisik dapat dibaca dan memiliki header PDF. Unduhan token mengirim PDF asli sebagai attachment; tidak membuat PDF pengganti. Nomor identitas dan kontak tidak ditambahkan ke hasil publik.

Migrasi `events.0002_event_thumbnail` menambahkan image opsional dan tidak mengubah kegiatan/peserta/sertifikat lama.

Pengaturan nomor saat impor maupun setelah impor dijelaskan pada [kontrol nomor sertifikat](certificate-number-controls.md). Perubahan nomor metadata tidak menimpa PDF final asli.

## QA
Gunakan kegiatan QA terpisah dengan peserta NIP tanpa NIK dan peserta NIK, PDF asli, serta gambar JPEG. Uji pencarian kedua identitas, download byte PDF, unggah gambar valid/tolak gambar rusak, thumbnail muncul pada hasil, respons mobile, dan pesan tanpa hasil. Hapus kegiatan dan semua berkas QA sesudah selesai.

Hasil verifikasi rilis: 124 tes backend terkait dan 57 tes frontend lulus. Smoke API live membuktikan NIP-only/NIK lookup, PDF attachment sesuai byte asli, thumbnail JPEG HTTP 200, serta penolakan gambar/identitas rusak. QA browser menekan Unduh Sertifikat dan membandingkan berkas unduhan, memeriksa thumbnail, layout desktop/mobile tanpa overflow horizontal, dan mengunggah ulang thumbnail melalui UI admin. Migrasi berhasil dan data/berkas QA dibersihkan. Dua sertifikat produksi yang tersisa memiliki PDF fisik yang dapat diunduh.
