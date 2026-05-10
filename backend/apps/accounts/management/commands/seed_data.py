"""Seed data contoh untuk SILAKHADIR."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.events.models import Event
from apps.participants.models import Participant
from apps.attendance.models import Attendance
from apps.settings_app.models import AppSetting
from apps.certificates.models import CertificateNumberFormat

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed data awal: user admin, event contoh, peserta, dan absensi.'

    def handle(self, *args, **options):
        self.stdout.write('Seeding users...')
        defaults_password = 'admin123'

        users_spec = [
            ('superadmin', 'superadmin@silakhadir.local', 'superadmin', True),
            ('admin', 'admin@silakhadir.local', 'admin', False),
            ('operator', 'operator@silakhadir.local', 'operator', False),
        ]
        users = {}
        for username, email, role, is_super in users_spec:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={'email': email, 'role': role},
            )
            user.role = role
            user.is_staff = True
            user.is_superuser = is_super
            user.set_password(defaults_password)
            user.save()
            users[username] = user
            self.stdout.write(
                self.style.SUCCESS(f'  - {username} ({role}) password: {defaults_password}')
            )

        self.stdout.write('Seeding app setting...')
        setting = AppSetting.get_instance()
        if not setting.institution_name:
            setting.institution_name = 'Dinas Komunikasi dan Informatika'
            setting.address = 'Jl. Merdeka No. 1, Jakarta'
            setting.head_name = 'Budi Santoso, S.T., M.M.'
            setting.head_position = 'Kepala Dinas'
            setting.save()

        self.stdout.write('Seeding certificate number formats...')
        formats = [
            {
                'name': 'Format Standar SIAKADIR',
                'pattern': '{seq3}/SIAKADIR/{event}/{month_roman}/{year}',
                'description': 'Format default: 001/SIAKADIR/NAMA-KEGIATAN/V/2026',
                'is_default': True,
            },
            {
                'name': 'Format Sederhana',
                'pattern': '{seq4}/SERT/{year}',
                'description': 'Contoh: 0001/SERT/2026',
                'is_default': False,
            },
            {
                'name': 'Format Dengan Tanggal',
                'pattern': '{seq3}/{app}/{event}/{day}-{month}-{year}',
                'description': 'Contoh: 001/SILAKHADIR/BIMTEK-SPBE/10-05-2026',
                'is_default': False,
            },
        ]
        for spec in formats:
            CertificateNumberFormat.objects.get_or_create(
                name=spec['name'], defaults=spec,
            )

        self.stdout.write('Seeding events...')
        now = timezone.now()
        samples = [
            {
                'title': 'Bimtek SPBE 2026',
                'theme': 'Percepatan Transformasi Digital Pemerintah',
                'description': 'Bimbingan teknis SPBE untuk OPD.',
                'start_date': now - timedelta(days=1),
                'end_date': now + timedelta(days=1),
                'location': 'Gedung Serbaguna',
                'organizer': 'Diskominfo',
                'status': Event.Status.OPEN,
            },
            {
                'title': 'Sosialisasi Keamanan Siber',
                'theme': 'Cyber Security Awareness',
                'description': 'Sosialisasi keamanan siber untuk aparatur.',
                'start_date': now - timedelta(days=14),
                'end_date': now - timedelta(days=13),
                'location': 'Aula Kantor',
                'organizer': 'Diskominfo',
                'status': Event.Status.DONE,
            },
        ]

        for spec in samples:
            event, created = Event.objects.get_or_create(
                title=spec['title'],
                defaults={**spec, 'created_by': users['admin']},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  - Event: {event.title}'))

                # Seed peserta + absensi
                for i in range(1, 6):
                    is_nik = bool(i % 2)
                    if is_nik:
                        identity_number = f'32010123456700{i:04d}'  # 16 digit
                    else:
                        identity_number = f'19900101202001{i:04d}'  # 18 digit
                    p = Participant.objects.create(
                        event=event,
                        identity_type='NIK' if is_nik else 'NIP',
                        identity_number=identity_number,
                        full_name=f'Peserta Contoh {i}',
                        institution='Dinas Kominfo',
                        position='Staff',
                        phone=f'0812000000{i:02d}',
                        email=f'peserta{i}@example.com',
                    )
                    if i <= 4:  # 4 hadir, 1 tidak
                        Attendance.objects.create(
                            event=event, participant=p,
                            status=Attendance.Status.HADIR,
                        )

        self.stdout.write(self.style.SUCCESS('Seed selesai.'))
