"""
Management command: backup_kinerja_gdrive
==========================================
Auto-backup laporan kinerja harian ke Google Drive.
Dijalankan via cron setiap hari jam 08:00 WIB.

Contoh penjadwalan cron:
    0 8 * * * cd /path/to/backend && /path/to/venv/bin/python manage.py backup_kinerja_gdrive

Atau jalankan manual:
    python manage.py backup_kinerja_gdrive
    python manage.py backup_kinerja_gdrive --tanggal 2026-07-06
"""
import io
import os
from datetime import date, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.kinerja.models import PeriodeKinerja, KinerjaHarian
from apps.kinerja.exports import export_laporan_excel


class Command(BaseCommand):
    help = 'Backup laporan kinerja harian ke Google Drive (default: data kemarin)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tanggal',
            type=str,
            default=None,
            help='Tanggal spesifik (YYYY-MM-DD). Default: kemarin.',
        )
        parser.add_argument(
            '--all-dates',
            action='store_true',
            default=False,
            help='Backup semua tanggal dalam periode aktif (bukan hanya 1 hari).',
        )

    def handle(self, *args, **options):
        # --- Validasi konfigurasi ---
        creds_file = settings.GDRIVE_CREDENTIALS_FILE
        folder_id = settings.GDRIVE_FOLDER_ID

        if not creds_file or not folder_id:
            raise CommandError(
                'Konfigurasi Google Drive belum lengkap.\n'
                'Pastikan GDRIVE_CREDENTIALS_FILE dan GDRIVE_FOLDER_ID '
                'sudah diatur di file .env'
            )

        if not os.path.isfile(creds_file):
            raise CommandError(
                f'File credentials tidak ditemukan: {creds_file}\n'
                'Download file JSON dari Google Cloud Console '
                'dan letakkan di path yang benar.'
            )

        # --- Import Google libraries ---
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaIoBaseUpload
        except ImportError:
            raise CommandError(
                'Library Google belum terinstal.\n'
                'Jalankan: pip install google-api-python-client google-auth'
            )

        # --- Tentukan tanggal ---
        if options['tanggal']:
            try:
                target_date = date.fromisoformat(options['tanggal'])
            except ValueError:
                raise CommandError(
                    f'Format tanggal tidak valid: {options["tanggal"]}. '
                    'Gunakan format YYYY-MM-DD.'
                )
        else:
            target_date = date.today() - timedelta(days=1)

        self.stdout.write(
            self.style.NOTICE(f'📅 Target tanggal backup: {target_date}')
        )

        # --- Cari periode aktif ---
        periodes = PeriodeKinerja.objects.filter(status='aktif')
        if not periodes.exists():
            self.stdout.write(
                self.style.WARNING('⚠️  Tidak ada periode kinerja aktif. Tidak ada yang di-backup.')
            )
            return

        # --- Autentikasi Google Drive ---
        SCOPES = ['https://www.googleapis.com/auth/drive.file']
        credentials = service_account.Credentials.from_service_account_file(
            creds_file, scopes=SCOPES,
        )
        drive_service = build('drive', 'v3', credentials=credentials)

        self.stdout.write(
            self.style.SUCCESS('✅ Autentikasi Google Drive berhasil.')
        )

        # --- Proses setiap periode aktif ---
        total_uploaded = 0

        for periode in periodes:
            entries = KinerjaHarian.objects.filter(
                periode=periode,
            ).order_by('nip_pegawai', 'tanggal')

            if not options['all_dates']:
                entries = entries.filter(tanggal=target_date)

            count = entries.count()
            if count == 0:
                self.stdout.write(
                    f'  ⏭️  {periode.nama}: Tidak ada data kinerja '
                    f'tanggal {target_date}. Dilewati.'
                )
                continue

            self.stdout.write(
                f'  📊 {periode.nama}: {count} entri ditemukan. Membuat Excel...'
            )

            # --- Generate Excel ke memory ---
            response = export_laporan_excel(periode, entries)
            excel_content = response.content

            # --- Tentukan nama file ---
            if options['all_dates']:
                file_name = (
                    f'Kinerja_{periode.bidang}_Semua_Tanggal.xlsx'
                )
            else:
                file_name = (
                    f'Kinerja_{periode.bidang}_{target_date.isoformat()}.xlsx'
                )

            # --- Upload ke Google Drive ---
            file_metadata = {
                'name': file_name,
                'parents': [folder_id],
                'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
            media = MediaIoBaseUpload(
                io.BytesIO(excel_content),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                resumable=True,
            )

            try:
                uploaded = drive_service.files().create(
                    body=file_metadata,
                    media_body=media,
                    fields='id, name, webViewLink',
                ).execute()

                self.stdout.write(self.style.SUCCESS(
                    f'  ✅ Berhasil upload: {uploaded["name"]}\n'
                    f'     🔗 Link: {uploaded.get("webViewLink", "-")}'
                ))
                total_uploaded += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  ❌ Gagal upload {file_name}: {e}'
                ))

        # --- Ringkasan ---
        self.stdout.write('')
        if total_uploaded > 0:
            self.stdout.write(self.style.SUCCESS(
                f'🎉 Backup selesai! {total_uploaded} file berhasil diupload ke Google Drive.'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                '⚠️  Tidak ada file yang diupload. '
                'Mungkin belum ada data kinerja untuk tanggal tersebut.'
            ))
