# Generated manually for NIK wajib + NIP khusus ASN

import django.core.validators
from django.db import migrations, models


def migrate_identity_to_nik_nip(apps, schema_editor):
    Participant = apps.get_model('participants', 'Participant')
    used = set()
    fallback_counter = 1

    for participant in Participant.objects.all().order_by('event_id', 'created_at'):
        old_type = (participant.identity_type or 'NIK').upper()
        old_number = ''.join(ch for ch in (participant.identity_number or '') if ch.isdigit())

        if old_type == 'NIK' and len(old_number) == 16:
            nik = old_number
            nip = ''
            is_asn = False
        else:
            # Data lama bertipe NIP tidak menyimpan NIK. Untuk menjaga migration tetap
            # berjalan, NIP lama disalin ke field NIP dan NIK sementara dibuat unik.
            nip = old_number[:18] if len(old_number) >= 18 else ''
            is_asn = True
            nik = old_number[-16:] if len(old_number) >= 16 else old_number.zfill(16)

        key = (participant.event_id, nik)
        while not nik or key in used:
            nik = f'9999{fallback_counter:012d}'
            fallback_counter += 1
            key = (participant.event_id, nik)

        participant.nik = nik
        participant.nip = nip
        participant.is_asn = is_asn
        participant.save(update_fields=['nik', 'nip', 'is_asn'])
        used.add(key)


class Migration(migrations.Migration):

    dependencies = [
        ('participants', '0001_initial'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='participant',
            name='unique_participant_per_event',
        ),
        migrations.AddField(
            model_name='participant',
            name='nik',
            field=models.CharField(
                default='',
                max_length=16,
                validators=[
                    django.core.validators.RegexValidator(
                        '^[0-9]{16}$', 'NIK harus 16 digit angka.',
                    ),
                ],
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='participant',
            name='nip',
            field=models.CharField(
                blank=True,
                default='',
                max_length=18,
                validators=[
                    django.core.validators.RegexValidator(
                        '^[0-9]{18}$', 'NIP harus 18 digit angka.',
                    ),
                ],
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='participant',
            name='is_asn',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(migrate_identity_to_nik_nip, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='participant',
            name='identity_type',
        ),
        migrations.RemoveField(
            model_name='participant',
            name='identity_number',
        ),
        migrations.AddConstraint(
            model_name='participant',
            constraint=models.UniqueConstraint(
                fields=('event', 'nik'),
                name='unique_participant_per_event',
            ),
        ),
    ]
