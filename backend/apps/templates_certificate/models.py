from django.db import models


class CertificateTemplate(models.Model):
    """
    Template sertifikat. Menggunakan konfigurasi koordinat sederhana
    (dalam satuan persen relatif terhadap ukuran background) sehingga
    tidak bergantung pada dimensi gambar.
    """
    name = models.CharField(max_length=150)
    background_image = models.ImageField(upload_to='cert_templates/')

    signer_name = models.CharField(max_length=150, blank=True)
    signer_position = models.CharField(max_length=150, blank=True)
    signature_image = models.ImageField(upload_to='cert_signs/', null=True, blank=True)
    stamp_image = models.ImageField(upload_to='cert_stamps/', null=True, blank=True)

    # Posisi dalam persen (0-100)
    name_position_x = models.FloatField(default=50)
    name_position_y = models.FloatField(default=45)
    event_position_x = models.FloatField(default=50)
    event_position_y = models.FloatField(default=58)
    date_position_x = models.FloatField(default=50)
    date_position_y = models.FloatField(default=70)
    qr_position_x = models.FloatField(default=10)
    qr_position_y = models.FloatField(default=85)
    number_position_x = models.FloatField(default=50)
    number_position_y = models.FloatField(default=30)

    # Ukuran font (pt)
    name_font_size = models.PositiveSmallIntegerField(default=36)
    event_font_size = models.PositiveSmallIntegerField(default=20)
    date_font_size = models.PositiveSmallIntegerField(default=16)
    number_font_size = models.PositiveSmallIntegerField(default=14)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name
