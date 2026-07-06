from django.contrib import admin

from .models import PeriodeKinerja, KinerjaHarian


@admin.register(PeriodeKinerja)
class PeriodeKinerjaAdmin(admin.ModelAdmin):
    list_display = ('nama', 'bulan', 'tahun', 'bidang', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'tahun', 'bidang')
    search_fields = ('nama', 'bidang')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(KinerjaHarian)
class KinerjaHarianAdmin(admin.ModelAdmin):
    list_display = ('pegawai', 'tanggal', 'uraian_kegiatan', 'output', 'volume', 'satuan', 'periode')
    list_filter = ('periode', 'tanggal')
    search_fields = ('uraian_kegiatan', 'output', 'pegawai__username', 'pegawai__nip')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('pegawai', 'periode')
