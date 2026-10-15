from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('attendance', '0001_initial')]

    operations = [
        migrations.AddField(
            model_name='attendance',
            name='feedback',
            field=models.TextField(
                'Kritik dan Saran', blank=True, default='', max_length=2000,
            ),
        ),
    ]
