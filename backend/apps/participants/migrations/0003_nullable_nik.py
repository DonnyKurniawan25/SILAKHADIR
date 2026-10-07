from django.core.validators import RegexValidator
from django.db import migrations, models


def normalize_blank_nik(apps, schema_editor):
    Participant = apps.get_model('participants', 'Participant')
    Participant.objects.using(schema_editor.connection.alias).filter(nik='').update(nik=None)


class Migration(migrations.Migration):
    dependencies = [('participants', '0002_nik_nip_is_asn')]
    operations = [
        migrations.AlterField(
            model_name='participant', name='nik',
            field=models.CharField(max_length=16, blank=True, null=True,
                validators=[RegexValidator(r'^[0-9]{16}$', 'NIK harus 16 digit angka.')]),
        ),
        # Irreversible: multiple NIP-only participants cannot become unique ''.
        migrations.RunPython(normalize_blank_nik),
    ]
