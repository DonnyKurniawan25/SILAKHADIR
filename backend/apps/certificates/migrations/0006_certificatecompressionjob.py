import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('certificates', '0005_certificateimportbatch_certificateimportitem'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [migrations.CreateModel(
        name='CertificateCompressionJob',
        fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('certificate_ids', models.JSONField(default=list)),
            ('results', models.JSONField(default=list)),
            ('processed', models.PositiveIntegerField(default=0)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('event', models.ForeignKey(to='events.event', on_delete=django.db.models.deletion.CASCADE)),
            ('owner', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE)),
        ],
    )]
