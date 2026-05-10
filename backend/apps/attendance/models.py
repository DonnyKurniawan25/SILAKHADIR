import uuid

from django.db import models


def signature_upload_to(instance, filename):
    return f'signatures/{instance.event_id}/{instance.id}-{filename}'


def photo_upload_to(instance, filename):
    return f'photos/{instance.event_id}/{instance.id}-{filename}'


class Attendance(models.Model):
    """Catatan kehadiran peserta."""

    class Status(models.TextChoices):
        HADIR = 'hadir', 'Hadir'
        TIDAK_HADIR = 'tidak_hadir', 'Tidak Hadir'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    event = models.ForeignKey(
        'events.Event', on_delete=models.CASCADE, related_name='attendances'
    )
    participant = models.ForeignKey(
        'participants.Participant', on_delete=models.CASCADE,
        related_name='attendances',
    )

    attendance_time = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    # Tanda tangan bisa diupload sebagai file atau base64 PNG
    signature = models.ImageField(upload_to=signature_upload_to, null=True, blank=True)
    photo = models.ImageField(upload_to=photo_upload_to, null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.HADIR
    )

    class Meta:
        ordering = ['-attendance_time']
        constraints = [
            models.UniqueConstraint(
                fields=('event', 'participant'),
                name='unique_attendance_per_event_participant',
            ),
        ]

    def __str__(self):
        return f'{self.participant} @ {self.event} ({self.status})'
