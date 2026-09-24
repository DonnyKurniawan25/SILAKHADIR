from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('templates_certificate', '0003_signature_layout')]

    operations = [
        migrations.AddField(
            model_name='certificatetemplate',
            name='qr_size',
            field=models.FloatField(default=14),
        ),
    ]
