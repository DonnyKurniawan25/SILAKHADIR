# Pemetaan dan verifikasi sertifikat

## Impor PDF
- Nama terdeteksi yang cocok persis setelah normalisasi dan unik pada peserta hadir dipilih otomatis. Nama ambigu, tidak ditemukan, dan penugasan duplikat perlu diperiksa manual.
- Dropdown peserta dapat dicari berdasarkan nama, NIK, atau NIP; pilihan Lewati tetap tersedia.
- Pemetaan otomatis bukan verifikasi. Periksa PDF dan identitas, lalu Verifikasi per baris atau Verifikasi SEMUA.
- Batalkan verifikasi per baris/semua untuk koreksi. Perubahan peserta atau nomor membatalkan verifikasi terkait.
- Impor hanya dapat diterapkan jika semua baris yang dipilih sudah diverifikasi, tanpa peserta duplikat.

## Sertifikat tersimpan
- POST `/api/events/{event_id}/certificates/{id}/verify/` dan `/cancel-verification/`.
- POST `/api/events/{event_id}/certificates/verify-all/` dan `/cancel-verification-all/`.
- Body `{}` memproses semua sertifikat kegiatan, bukan hanya halaman terlihat. Body `{"ids":["UUID"]}` membatasi pilihan.
- Verifikasi mengubah status menjadi `tersedia`; pembatalan menjadi `diproses`. PDF tetap disimpan saat pembatalan.
- Verifikasi memerlukan berkas PDF fisik dan peserta hadir. Operasi massal divalidasi seluruhnya sebelum perubahan, dengan otorisasi admin/superadmin.
- Untuk mengganti PDF salah, batalkan verifikasi lalu impor PDF yang benar dengan opsi Ganti sertifikat yang sudah ada.

## Pengujian
Jalankan suite certificate/participants/attendance terkait dalam container Django dengan `config.settings_test`, dan `node --test frontend/src/utils/*.test.mjs frontend/src/api/*.test.mjs frontend/src/components/*.test.mjs`. Uji smoke live menggunakan kegiatan QA terpisah, lalu hapus kegiatan dan file QA.

Catatan regresi saat rilis: 102 tes backend terkait dan 44 tes frontend lulus; smoke API/UI live lulus. Suite penuh 106 tes menemukan satu kegagalan lama di `apps.attendance.test_lookup.AttendanceProfileLookupTests.test_reuses_profile_from_previous_event_without_exposing_contact`: endpoint lookup publik mengembalikan phone/email, sedangkan tes mengharapkan kedua kolom tidak diekspos. File lookup publik tidak diubah pada rilis sertifikat ini; isu tersebut perlu ditangani terpisah.
