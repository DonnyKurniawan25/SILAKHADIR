from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model dengan role untuk SILAKHADIR."""

    class Role(models.TextChoices):
        SUPERADMIN = 'superadmin', 'Super Admin'
        ADMIN = 'admin', 'Admin Kegiatan'
        OPERATOR = 'operator', 'Operator'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERATOR,
    )
    nip = models.CharField(
        max_length=20, blank=True, null=True, unique=True,
        help_text='Nomor Induk Pegawai (NIP) ASN.',
    )
    jabatan = models.CharField(
        max_length=200, blank=True,
        help_text='Jabatan pegawai.',
    )
    phone = models.CharField(max_length=20, blank=True)
    institution = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-date_joined']

    def is_superadmin(self) -> bool:
        return self.role == self.Role.SUPERADMIN or self.is_superuser

    def is_admin_role(self) -> bool:
        return self.role in (self.Role.SUPERADMIN, self.Role.ADMIN)

    def is_operator(self) -> bool:
        return self.role == self.Role.OPERATOR


class ActivityLog(models.Model):
    """Audit log sederhana untuk aktivitas admin."""
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='activity_logs'
    )
    action = models.CharField(max_length=100)
    target = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.action} @ {self.created_at:%Y-%m-%d %H:%M}'
