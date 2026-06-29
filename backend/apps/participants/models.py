import uuid

from django.core.validators import RegexValidator
from django.db import models


class Participant(models.Model):
    """Peserta kegiatan."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    event = models.ForeignKey(
        'events.Event', on_delete=models.CASCADE, related_name='participants'
    )

    nik = models.CharField(
        max_length=16,
        validators=[RegexValidator(r'^[0-9]{16}$', 'NIK harus 16 digit angka.')],
    )
    nip = models.CharField(
        max_length=18,
        blank=True,
        validators=[RegexValidator(r'^[0-9]{18}$', 'NIP harus 18 digit angka.')],
    )
    is_asn = models.BooleanField(default=False)
    full_name = models.CharField(max_length=200)
    institution = models.CharField(max_length=200, blank=True)
    position = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=('event', 'nik'),
                name='unique_participant_per_event',
            )
        ]

    def __str__(self):
        if self.nip:
            return f'{self.full_name} ({self.nik} / NIP: {self.nip})'
        return f'{self.full_name} ({self.nik})'
