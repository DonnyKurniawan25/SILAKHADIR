from django.db import models


class AppSetting(models.Model):
    """Singleton pengaturan aplikasi."""

    app_name = models.CharField(max_length=120, default='SILAKHADIR')
    tagline = models.CharField(
        max_length=200,
        default='Absensi Online dan Sertifikat Digital Kegiatan',
    )
    institution_name = models.CharField(max_length=200, blank=True)
    institution_logo = models.ImageField(upload_to='branding/', null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)

    head_name = models.CharField(max_length=150, blank=True)
    head_position = models.CharField(max_length=150, blank=True)
    signature_image = models.ImageField(upload_to='branding/', null=True, blank=True)
    stamp_image = models.ImageField(upload_to='branding/', null=True, blank=True)

    primary_color = models.CharField(max_length=20, default='#0b2d6b')
    secondary_color = models.CharField(max_length=20, default='#d1a827')

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Pengaturan Aplikasi'
        verbose_name_plural = 'Pengaturan Aplikasi'

    def __str__(self):
        return self.app_name

    @classmethod
    def get_instance(cls) -> 'AppSetting':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
