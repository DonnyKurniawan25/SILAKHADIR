# Kontrak Excel absensi kegiatan

Backend API (prefix `/api`):

- `GET /api/events/{eventId}/attendance/template-xlsx/`
- `GET /api/events/{eventId}/attendance/export-xlsx/`
- `POST /api/events/{eventId}/attendance/import-xlsx/`

Semua endpoint hanya untuk role `admin`/`superadmin`. GET mengembalikan attachment
`.xlsx` dengan MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

POST menggunakan `multipart/form-data`: `file` wajib file `.xlsx`; `dry_run`
opsional berupa string `true` (default) atau `false`. Nilai lain ditolak.

Kolom persis berurutan:
`NIK,NIP,Nama Lengkap,Instansi,Jabatan,No HP,Email,Status`.
Sheet `Absensi` diutamakan; untuk workbook pihak ketiga sheet pertama diterima
kecuali bernama `Contoh`/`Petunjuk`. Template menyediakan sheet Absensi kosong,
Petunjuk dan Contoh terpisah; contoh tidak otomatis diimpor.

NIK wajib 16 digit ASCII, NIP opsional 18 digit ASCII. NIK/NIP/No HP harus berupa
sel teks, bukan sel numerik (angka yang telah dibulatkan Excel tidak direkonstruksi).
Nama dan status wajib; status tepat `hadir` atau `tidak_hadir`. Validasi panjang
field dan email mengikuti model Participant. Baris kosong dilewati. Baris error
menggunakan nomor baris Excel termasuk header (data pertama row=2).

Response POST:

```text
{
  rows: [{row, nik, nip, full_name, institution, position, phone, email, status,
          participant_id, attendance_id, action}],
  created: integer,
  updated: integer,
  errors: [{row: integer|null, message: string}],
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
menyimpan hanya jika semua baris bebas error. Upsert berdasarkan `(event, nik)`
dan `(event, participant)`; impor berulang tidak membuat duplikat. NIK/nama
duplikat dalam file, NIK yang sudah memiliki nama berbeda, atau nama yang cocok
dengan NIK lain dalam event ditolak. Nama dibandingkan case-insensitive dengan
whitespace dinormalisasi. Kolom opsional kosong tidak menghapus nilai lama. NIP
nonkosong menandai is_asn=true. Tidak membuat PDF/sertifikat otomatis.

Export memuat seluruh absensi event (kedua status), delapan field tersebut,
identitas dan semua nilai disimpan sebagai sel teks eksplisit agar digit tetap
utuh dan awalan `=`, `+`, `-`, `@` tidak menjadi formula.

Batas: 5 MB upload, 5000 baris data (5001 termasuk header), 25 MB total ukuran
hasil ekstraksi ZIP, 100 anggota ZIP, 10 sheet, 64 kolom internal maksimum. Tolak
formula pada semua sheet, DTD/entity, macro, workbook external links, arsip
encrypted/path tidak aman, komponen duplikat dan rasio kompresi ekstrem.

## Pengujian terisolasi

```sh
DB_ENGINE=sqlite python manage.py test apps.attendance.test_xlsx \
  --settings=apps.attendance.test_xlsx_settings --verbosity=1
```

Settings pengujian mengganti DATABASES menjadi SQLite `:memory:` secara eksplisit;
tidak menggunakan DB produksi. Dependensi openpyxl sudah ada pada requirements
repo (`openpyxl==3.1.2`); requirements tidak diubah.
