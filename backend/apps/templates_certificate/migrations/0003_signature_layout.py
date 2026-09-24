from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('templates_certificate', '0002_default_certificate_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='certificatetemplate', name='signature_position_x',
            field=models.FloatField(default=82),
        ),
        migrations.AddField(
            model_name='certificatetemplate', name='signature_position_y',
            field=models.FloatField(default=82),
        ),
        migrations.AddField(
            model_name='certificatetemplate', name='signature_width',
            field=models.FloatField(default=14),
        ),
        migrations.AddField(
            model_name='certificatetemplate', name='signature_height',
            field=models.FloatField(default=8),
        ),
    ]
