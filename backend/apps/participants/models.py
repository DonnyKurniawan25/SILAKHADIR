import uuid

from django.core.validators import RegexValidator
from django.db import models


class Participant(models.Model):
    """Peserta kegiatan."""

    class IdentityType(models.TextChoices):
        NIK = 'NIK', 'NIK'
        NIP = 'NIP', 'NIP'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    event = models.ForeignKey(
        'events.Event', on_delete=models.CASCADE, related_name='participants'
    )

    identity_type = models.CharField(
        max_length=3, choices=IdentityType.choices, default=IdentityType.NIK
    )
    identity_number = models.CharField(
        max_length=32,
        validators=[RegexValidator(r'^[0-9]{8,32}$', 'Angka saja, minimal 8 digit.')],
    )
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
                fields=('event', 'identity_number'),
                name='unique_participant_per_event',
            )
        ]

    def __str__(self):
        return f'{self.full_name} ({self.identity_number})'
