import uuid

from django.conf import settings
from django.db import models


class Event(models.Model):
    """Model kegiatan."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        OPEN = 'open', 'Dibuka'
        CLOSED = 'closed', 'Ditutup'
        DONE = 'done', 'Selesai'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    title = models.CharField(max_length=255)
    theme = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    location = models.CharField(max_length=255, blank=True)
    organizer = models.CharField(max_length=255, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    attendance_open = models.BooleanField(default=True)

    certificate_template = models.ForeignKey(
        'templates_certificate.CertificateTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events',
    )

    # Slug/token publik untuk URL absensi
    public_slug = models.SlugField(max_length=64, unique=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='events_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.public_slug:
            self.public_slug = uuid.uuid4().hex[:16]
        super().save(*args, **kwargs)

    def is_accepting_attendance(self) -> bool:
        return self.attendance_open and self.status in (self.Status.OPEN,)
