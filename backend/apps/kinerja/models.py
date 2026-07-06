"""Kinerja Harian ASN - Pencatatan kinerja harian per periode."""
import uuid

from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class PeriodeKinerja(models.Model):
    """Periode pencatatan kinerja (per bulan per bidang)."""

    class Status(models.TextChoices):
        AKTIF = 'aktif', 'Aktif'
        DITUTUP = 'ditutup', 'Ditutup'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    nama = models.CharField(
        max_length=255,
        help_text='Nama periode, e.g. "Juli 2026 - Bidang Pemerintahan Digital".',
    )
    bulan = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text='Bulan (1-12).',
    )
    tahun = models.PositiveIntegerField(
        help_text='Tahun, e.g. 2026.',
    )
    bidang = models.CharField(
        max_length=255,
        help_text='Nama bidang, e.g. "Pemerintahan Digital".',
    )
    deskripsi = models.TextField(
        blank=True,
        help_text='Deskripsi atau catatan untuk periode ini.',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AKTIF,
    )
    kepala_bidang_nama = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Nama Kepala Bidang untuk penandatanganan.',
    )
    kepala_bidang_nip = models.CharField(
        max_length=50, blank=True, default='',
        help_text='NIP Kepala Bidang untuk penandatanganan.',
    )

    # Slug publik untuk URL form pengisian kinerja (tanpa login)
    public_slug = models.SlugField(
        max_length=64, unique=True, blank=True, null=True,
        help_text='Slug unik untuk link form publik pengisian kinerja.',
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='periodes_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-tahun', '-bulan']
        verbose_name = 'Periode Kinerja'
        verbose_name_plural = 'Periode Kinerja'
        unique_together = ['bulan', 'tahun', 'bidang']

    def __str__(self):
        return self.nama

    def save(self, *args, **kwargs):
        if not self.public_slug:
            self.public_slug = uuid.uuid4().hex[:16]
        super().save(*args, **kwargs)


class KinerjaHarian(models.Model):
    """Catatan kinerja harian per pegawai per periode.

    Field pegawai bersifat opsional — entri dari form publik menggunakan
    nama_pegawai dan nip_pegawai sebagai pengganti FK user.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    periode = models.ForeignKey(
        PeriodeKinerja,
        on_delete=models.CASCADE,
        related_name='kinerja_entries',
    )
    # FK ke User (opsional — bisa null jika diisi via form publik)
    pegawai = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='kinerja_entries',
    )

    # Data pegawai langsung (selalu diisi, baik dari form publik maupun admin)
    nama_pegawai = models.CharField(
        max_length=200, default='',
        help_text='Nama lengkap pegawai.',
    )
    nip_pegawai = models.CharField(
        max_length=20, default='',
        help_text='NIP pegawai.',
    )

    email_pegawai = models.EmailField(
        max_length=254, blank=True, default='',
        help_text='Surel pegawai.',
    )
    no_hp_pegawai = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Nomor HP/handphone pegawai.',
    )
    jabatan_pegawai = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Jabatan pegawai.',
    )

    tanggal = models.DateField(
        help_text='Tanggal kegiatan dilakukan.',
    )
    uraian_kegiatan = models.TextField(
        help_text='Deskripsi kegiatan yang dilakukan.',
    )
    output = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='Hasil/output kegiatan, e.g. "Dokumen Rancangan Sistem".',
    )
    volume = models.DecimalField(
        max_digits=10, decimal_places=2, default=1,
        null=True, blank=True,
        help_text='Jumlah/volume pekerjaan.',
    )
    satuan = models.CharField(
        max_length=100,
        null=True, blank=True,
        help_text='Satuan, e.g. "Dokumen", "Kegiatan", "Laporan".',
    )
    link_bukti = models.URLField(
        max_length=500, blank=True,
        help_text='Link bukti dukung (opsional), e.g. Google Drive link.',
    )
    keterangan = models.TextField(
        blank=True,
        help_text='Catatan tambahan (opsional).',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tanggal', 'created_at']
        verbose_name = 'Kinerja Harian'
        verbose_name_plural = 'Kinerja Harian'

    def __str__(self):
        return f'{self.nama_pegawai} - {self.tanggal} - {self.uraian_kegiatan[:50]}'
