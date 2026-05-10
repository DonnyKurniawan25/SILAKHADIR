import uuid

from django.db import models


def certificate_pdf_upload(instance, filename):
    return f'certificates/{instance.event_id}/{instance.certificate_number.replace("/", "_")}.pdf'


def certificate_qr_upload(instance, filename):
    return f'certificates/qr/{instance.id}.png'


class CertificateNumberFormat(models.Model):
    """
    Master format nomor sertifikat (dikelola Super Admin).

    Pattern menggunakan placeholder Python str.format, contoh:
        {seq3}/SIAKADIR/{event}/{month_roman}/{year}

    Placeholder yang tersedia:
        {seq}         nomor urut (integer)
        {seq3}        nomor urut 3 digit, zero-padded
        {seq4}        nomor urut 4 digit, zero-padded
        {app}         nama aplikasi dari AppSetting (default SILAKHADIR)
        {event}       nama kegiatan (uppercase, dash, maks 30 char)
        {year}        tahun 4 digit
        {month}       bulan 2 digit
        {month_roman} bulan dalam angka Romawi (I..XII)
        {day}         tanggal 2 digit
    """

    name = models.CharField(max_length=150, unique=True)
    pattern = models.CharField(
        max_length=255,
        default='{seq3}/SIAKADIR/{event}/{month_roman}/{year}',
    )
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)

    # Counter global jika diinginkan; default: counter dihitung per event.
    use_global_counter = models.BooleanField(default=False)
    last_sequence = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Pastikan hanya 1 default
        if self.is_default:
            CertificateNumberFormat.objects.exclude(pk=self.pk).filter(
                is_default=True
            ).update(is_default=False)


class Certificate(models.Model):
    """Sertifikat digital untuk peserta."""

    class Status(models.TextChoices):
        AVAILABLE = 'tersedia', 'Tersedia'
        PROCESSING = 'diproses', 'Diproses'
        REVOKED = 'dicabut', 'Dicabut'

    class Source(models.TextChoices):
        GENERATED = 'generated', 'Generated Otomatis'
        UPLOADED = 'uploaded', 'Upload Manual'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    event = models.ForeignKey(
        'events.Event', on_delete=models.CASCADE, related_name='certificates'
    )
    participant = models.ForeignKey(
        'participants.Participant', on_delete=models.CASCADE,
        related_name='certificates',
    )

    certificate_number = models.CharField(max_length=100)
    number_format = models.ForeignKey(
        CertificateNumberFormat,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='certificates',
    )

    pdf_file = models.FileField(upload_to=certificate_pdf_upload, null=True, blank=True)
    qr_code = models.ImageField(upload_to=certificate_qr_upload, null=True, blank=True)

    verification_token = models.CharField(max_length=64, unique=True)
    download_token = models.CharField(max_length=64, unique=True)

    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.UPLOADED
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.AVAILABLE
    )

    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-generated_at']
        constraints = [
            models.UniqueConstraint(
                fields=('event', 'participant'),
                name='unique_certificate_per_event_participant',
            ),
        ]

    def __str__(self):
        return self.certificate_number

    def save(self, *args, **kwargs):
        if not self.verification_token:
            self.verification_token = uuid.uuid4().hex
        if not self.download_token:
            self.download_token = uuid.uuid4().hex
        super().save(*args, **kwargs)
