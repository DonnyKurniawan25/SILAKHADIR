# Kontrak Excel absensi kegiatan

Backend API (prefix `/api`):

- `GET /api/events/{eventId}/attendance/template-xlsx/`
- `GET /api/events/{eventId}/attendance/export-xlsx/`
- `POST /api/events/{eventId}/attendance/import-xlsx/`

Semua endpoint hanya untuk role `admin`/`superadmin`. GET mengembalikan attachment
`.xlsx` dengan MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

POST tetap menerima `multipart/form-data`: `file` wajib file `.xlsx`; `dry_run`
opsional berupa string `true` (default) atau `false`. Nilai lain ditolak.

Endpoint yang **sama** juga menerima `application/json` untuk hasil review yang
sudah diedit: `{rows: [{row, nik, nip, full_name, institution, position, phone,
email, status}], dry_run: true|false}`. `dry_run` JSON adalah boolean (default
true), bukan string. Batas JSON 5 MB sebelum parsing dan 5000 baris; `row` asli
harus integer unik 2–5001. Nilai field harus teks atau null/kosong, identitas
numerik/scientific tidak diperbaiki. Formula `=` dan karakter kontrol tidak aman
ditolak. Hanya delapan field data dan nomor `row` digunakan; `participant_id`,
`attendance_id`, `system_status`, `system_record`, `correction_fields`, history,
`match_state`, dan `_errors` dari klien diabaikan. DB divalidasi ulang setiap
request. Frontend boleh menghapus baris sebelum mengirim; ini menghilangkan baris
dari batch, **bukan** menghapus peserta yang sudah tersimpan. Batch apply kosong
(JSON maupun XLSX) ditolak; preview kosong dan template XLSX kosong tetap tersedia.

Kolom persis berurutan:
`NIK,NIP,Nama Lengkap,Instansi,Jabatan,No HP,Email,Status`.
Sheet `Absensi` diutamakan; untuk workbook pihak ketiga sheet pertama diterima
kecuali bernama `Contoh`/`Petunjuk`. Template menyediakan sheet Absensi kosong,
Petunjuk dan Contoh terpisah; contoh tidak otomatis diimpor.

Nama Lengkap dan minimal satu identitas wajib: ASN dengan NIP 18 digit ASCII
boleh tanpa NIK; jika NIP tidak ada, NIK 16 digit ASCII wajib. Jika keduanya diisi,
keduanya harus valid dan konsisten. Identitas kosong, `-`, atau `—` dianggap tidak
ada. Semua field lainnya opsional; status kosong menjadi `hadir`, sedangkan status
nonkosong harus tepat `hadir` atau `tidak_hadir`.

NIK/NIP wajib berupa sel **Text**, bukan angka. Sel numerik (termasuk integer,
float, dan notasi ilmiah) ditolak dengan pesan `format angka ilmiah/digit mungkin
berubah; ubah kolom ke Text dan tempel ulang dari sumber asli`. Tidak ada konversi
atau rekonstruksi digit identitas yang sudah dibulatkan Excel. No HP sebaiknya
Text untuk mempertahankan nol awal; angka bulat nonnegatif maksimal 15 digit boleh
dinormalisasi menjadi teks, tanpa mengarang nol awal. Angka pecahan/negatif atau
lebih panjang ditolak. Validasi panjang field dan email mengikuti model
Participant. Baris kosong dilewati. Error memakai nomor baris Excel termasuk
header (data pertama row=2).

Response POST:

```text
{
  rows: [{row, nik, nip, full_name, institution, position, phone, email, status,
          participant_id, attendance_id, action,
          system_status: 'existing'|'new'|'conflict'|'ambiguous',
          system_record: {full_name, nik, nip}|null,
          correction_fields: ['nik','nip','full_name'],
          certificate_history: {has_certificates: boolean, count: integer,
                                events: [{id: string, title: string}]}}],
  created: integer,
  updated: integer,
  errors: [{row: integer|null, column: string|null, message: string, hint: string}],
  dry_run: boolean
}
```

`action` adalah `created`/`updated` untuk baris valid, `null` untuk baris tidak
valid. Counter adalah rencana upsert **catatan absensi** baris valid: peserta yang
sudah ada namun belum memiliki absensi tetap dihitung created. Preview menampilkan
ID hanya jika benar-benar sudah ada di database; ID data baru null sampai apply.
Tidak ada ID fiktif. Pada error validasi/konflik, HTTP 400 dan seluruh impor batal;
counter hanya rencana, bukan jumlah perubahan tersimpan. Error tingkat file atau
konflik transaksi memakai row=null. Sukses HTTP 200, termasuk preview kosong.

`dry_run=false` mengunci event dan memvalidasi ulang database dalam transaksi;
menyimpan hanya jika semua baris bebas error. Registry baca-saja memakai catatan
peserta dari **seluruh kegiatan** tanpa tabel global baru. Pasangan identitas
persis yang konsisten di beberapa event dianggap orang yang sama; nama dinormalisasi
case/whitespace sebagai pemeriksaan kompatibilitas, bukan kunci tautan otomatis.
`existing` hanya untuk identitas nyata yang cocok dan konsisten; `new` belum cocok.
Nama yang sama dengan pasangan sistem unik dapat menjelaskan koreksi:
- NIP sama / NIK berbeda: `conflict`, `correction_fields: ['nik']`.
- NIK sama / NIP berbeda: `conflict`, `correction_fields: ['nip']`.
- Keduanya berbeda dengan nama sama: `conflict`, `['nik','nip']`.
- Identitas sama / nama berbeda: `conflict`, `['full_name']`.

`system_record` menampilkan nilai sistem yang dikenal; errors menunjuk kolom yang
tepat dengan hint nilai sistem. Benturan nama/beberapa pasangan bertentangan atau
beberapa peserta lokal cocok menjadi `ambiguous`, tanpa tebakan/system_record.
`correction_fields` hanya berisi subset field yang perlu diperbaiki; normalnya [].
Field sistem kosong tidak menjadi alasan menolak identitas baru yang valid.
Identitas kosong bisa dilengkapi dari pasangan yang diketahui melalui identifier
persis, tetapi tidak melalui nama saja. NIK yang belum diketahui tetap NULL.

Apply selalu membuat/memperbarui **peserta milik event tujuan**, tidak menulis
ulang peserta historis/global. Peserta NIP-only lokal yang memperoleh NIK tetap
mempertahankan ID peserta/absensi. Nilai kosong tidak menghapus data lama.
Duplikat NIK efektif (termasuk hasil pengayaan), NIP/nama dalam batch ditolak.
NIP nonkosong menandai is_asn=true. Impor berulang idempotent; upsert absensi
berdasarkan `(event, participant)`. Tidak membuat PDF/Certificate, bahkan placeholder.

`certificate_history` selalu hadir pada row XLSX/JSON dan pada ParticipantSerializer
(API daftar/detail peserta), sehingga riwayat tetap terlihat saat dibuka kembali.
History menghitung Certificate nyata dengan status `tersedia`, `pdf_file` nonkosong,
dan file benar-benar tersedia di storage, dari catatan beridentitas kompatibel
lintas event. Tidak menghitung placeholder tanpa PDF, file hilang, diproses/dicabut.
Tidak menghasilkan sertifikat baru. `count` menghitung sertifikat dan `events`
unik berisi ID string/judul kegiatan; tanpa history `{has_certificates:false,
count:0,events:[]}`. Registry/certificate dibaca batch (dua query), dipakai ulang
per serializer list, dan cek storage tiap path di-cache dalam request.

Migrasi `participants.0003_nullable_nik` mengubah NIK menjadi blank/null dan
menormalisasi legacy `nik=''` menjadi NULL; identitas nyata tidak diubah. Constraint
unik `(event, nik)` tetap ada dan mengizinkan beberapa NULL. Tidak menambahkan
constraint unik NIP tanpa pemeriksaan duplikat produksi. Migrasi normalisasi tidak
reversibel karena beberapa NULL tidak dapat dipetakan kembali menjadi string
kosong unik. Jalur formulir/API publik yang sudah mewajibkan NIK tetap wajib NIK.

Export memuat seluruh absensi event (kedua status), delapan field tersebut,
identitas dan semua nilai disimpan sebagai sel teks eksplisit agar digit tetap
utuh dan awalan `=`, `+`, `-`, `@` tidak menjadi formula.

Batas: 5 MB upload, 5000 baris data (5001 termasuk header), 25 MB total ukuran
hasil ekstraksi ZIP, 100 anggota ZIP, 10 sheet, 64 kolom internal maksimum. Tolak
formula pada semua sheet, DTD/entity, macro, workbook external links, arsip
encrypted/path tidak aman, komponen duplikat dan rasio kompresi ekstrem.

## Pengujian terisolasi

```sh
# Salin source ke direktori sementara, bukan /app produksi.
docker exec silakhadir-backend mkdir -p /tmp/edited-review-tests
docker cp /opt/silakhadir/app/backend/. silakhadir-backend:/tmp/edited-review-tests/
docker exec -w /tmp/edited-review-tests silakhadir-backend python manage.py test \
  apps.attendance.test_edited_review apps.attendance.test_xlsx \
  apps.attendance.test_xlsx_identity apps.attendance.test_identity_collision \
  apps.participants apps.certificates \
  --settings=config.settings_test --verbosity=1
```

Settings pengujian mengganti DATABASES menjadi SQLite `:memory:` secara eksplisit;
tidak menggunakan DB produksi. Dependensi openpyxl sudah ada pada requirements
repo (`openpyxl==3.1.2`); requirements tidak diubah.
