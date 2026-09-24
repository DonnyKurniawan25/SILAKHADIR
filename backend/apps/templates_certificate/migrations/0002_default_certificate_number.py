from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('templates_certificate', '0001_initial')]
    operations = [migrations.AddField(
        model_name='certificatetemplate', name='default_certificate_number',
        field=models.CharField(blank=True, default='', max_length=100),
    )]
