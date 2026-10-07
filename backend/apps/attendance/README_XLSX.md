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
          participant_id, attendance_id, action}],
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
menyimpan hanya jika semua baris bebas error. Identitas dicocokkan per event:
NIK jika diisi, NIP jika NIK tidak diisi. Jika NIK belum cocok tetapi NIP menunjuk
peserta NIP-only yang sama, NIK ditambahkan ke peserta tersebut tanpa membuat
peserta/absensi baru. NIK dan NIP yang menunjuk peserta berbeda ditolak.

Saat NIK tidak diisi, cari NIP persis pada kegiatan ini terlebih dahulu, kemudian
pada kegiatan lain. Nama wajib kompatibel (case-insensitive, whitespace
normalisasi); nama **tidak pernah** menjadi kunci lookup. NIK diketahui yang
konsisten digunakan ulang. Konflik nama/NIK antar kegiatan atau beberapa peserta
lokal dengan NIP sama ditolak untuk dikoreksi manual. Jika tidak ada NIK yang
diketahui, peserta tetap disimpan NIP-only dengan `nik=NULL`, bukan string kosong
atau identitas buatan. NIK lama tidak dihapus oleh impor yang mengosongkannya.
NIK preview dapat berupa null atau NIK yang ditemukan dari NIP.

NIK/NIP/nama duplikat dalam file, identitas dengan nama berbeda, atau nama yang
cocok dengan peserta lain dalam event ditolak. Kolom opsional kosong tidak
menghapus nilai lama. NIP nonkosong menandai is_asn=true. Impor berulang idempotent;
upsert absensi berdasarkan `(event, participant)`. Tidak membuat PDF/sertifikat.

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
docker exec silakhadir-backend mkdir -p /tmp/nip-tests
docker cp /opt/silakhadir/app/backend/. silakhadir-backend:/tmp/nip-tests/
docker exec -w /tmp/nip-tests silakhadir-backend python manage.py test \
  apps.attendance.test_xlsx apps.attendance.test_xlsx_identity \
  apps.participants.test_nullable_nik apps.certificates \
  --settings=config.settings_test --verbosity=1
```

Settings pengujian mengganti DATABASES menjadi SQLite `:memory:` secara eksplisit;
tidak menggunakan DB produksi. Dependensi openpyxl sudah ada pada requirements
repo (`openpyxl==3.1.2`); requirements tidak diubah.
