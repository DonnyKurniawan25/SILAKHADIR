"""Laporan Kegiatan - notulen, foto, link, lampiran."""
import uuid

from django.conf import settings
from django.db import models


def report_cover_upload(instance, filename):
    return f'reports/{instance.event_id}/cover-{filename}'


def report_photo_upload(instance, filename):
    return f'reports/{instance.report.event_id}/photos/{uuid.uuid4().hex}-{filename}'


def report_attachment_upload(instance, filename):
    return f'reports/{instance.report.event_id}/files/{uuid.uuid4().hex}-{filename}'


class EventReport(models.Model):
    """Satu laporan per kegiatan."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.OneToOneField(
        'events.Event', on_delete=models.CASCADE, related_name='report',
    )

    summary = models.TextField(
        blank=True, help_text='Ringkasan pelaksanaan kegiatan.',
    )
    cover_image = models.ImageField(
        upload_to=report_cover_upload, null=True, blank=True,
        help_text='Cover laporan (gambar full A4, ditampilkan di halaman pertama).',
    )
    notulen = models.TextField(
        blank=True, help_text='Notulen/catatan kegiatan.',
    )
    outcome = models.TextField(
        blank=True, help_text='Rekomendasi/tindak lanjut.',
    )

    author_name = models.CharField(max_length=150, blank=True)
    author_position = models.CharField(max_length=150, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='event_reports_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Laporan: {self.event.title}'


class EventReportPhoto(models.Model):
    """Dokumentasi foto kegiatan."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(
        EventReport, on_delete=models.CASCADE, related_name='photos',
    )
    image = models.ImageField(upload_to=report_photo_upload)
    caption = models.CharField(max_length=255, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']


class EventReportLink(models.Model):
    """Lampiran tautan (misalnya berita online)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(
        EventReport, on_delete=models.CASCADE, related_name='links',
    )
    label = models.CharField(max_length=200, help_text='Judul atau deskripsi link.')
    url = models.URLField(max_length=500)
    source = models.CharField(max_length=100, blank=True,
                              help_text='Nama media / sumber (opsional).')
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']


class EventReportAttachment(models.Model):
    """Lampiran berkas bebas (PDF, DOCX, XLSX, dsb)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(
        EventReport, on_delete=models.CASCADE, related_name='attachments',
    )
    label = models.CharField(max_length=200, help_text='Judul lampiran.')
    file = models.FileField(upload_to=report_attachment_upload)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
