from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import PeriodeKinerja, KinerjaHarian

User = get_user_model()


class PegawaiMiniSerializer(serializers.ModelSerializer):
    """Serializer ringkas untuk data pegawai di response kinerja."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'nip', 'jabatan', 'full_name', 'institution')

    def get_full_name(self, obj):
        name = obj.get_full_name()
        return name if name else obj.username


class PeriodeKinerjaSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    jumlah_entri = serializers.SerializerMethodField()
    jumlah_pegawai = serializers.SerializerMethodField()
    form_url = serializers.SerializerMethodField()

    class Meta:
        model = PeriodeKinerja
        fields = (
            'id', 'nama', 'bulan', 'tahun', 'bidang', 'deskripsi',
            'status', 'kepala_bidang_nama', 'kepala_bidang_nip', 'public_slug', 'form_url',
            'created_by', 'created_by_name',
            'jumlah_entri', 'jumlah_pegawai',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'public_slug', 'created_at', 'updated_at')

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return '-'

    def get_jumlah_entri(self, obj):
        return obj.kinerja_entries.count()

    def get_jumlah_pegawai(self, obj):
        return obj.kinerja_entries.values('nip_pegawai').distinct().count()

    def get_form_url(self, obj):
        from django.conf import settings
        return f'{settings.FRONTEND_URL}/kinerja/{obj.public_slug}'


class KinerjaHarianSerializer(serializers.ModelSerializer):
    class Meta:
        model = KinerjaHarian
        fields = (
            'id', 'periode', 'pegawai',
            'nama_pegawai', 'nip_pegawai', 'email_pegawai', 'no_hp_pegawai', 'jabatan_pegawai',
            'tanggal', 'uraian_kegiatan',
            'link_bukti', 'keterangan',
            'created_at', 'updated_at',
        )
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.pegawai:
            ret['nama_pegawai'] = instance.pegawai.get_full_name() or instance.pegawai.username
            ret['nip_pegawai'] = instance.pegawai.nip or ret['nip_pegawai']
            ret['email_pegawai'] = instance.pegawai.email or ret['email_pegawai']
            ret['no_hp_pegawai'] = instance.pegawai.phone or ret['no_hp_pegawai']
            ret['jabatan_pegawai'] = instance.pegawai.jabatan or ret['jabatan_pegawai']
            ret['instansi_pegawai'] = instance.pegawai.institution or ''
        else:
            ret['instansi_pegawai'] = ''
        return ret


class KinerjaHarianCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create/update kinerja harian (dari admin panel)."""

    class Meta:
        model = KinerjaHarian
        fields = (
            'id', 'periode', 'tanggal',
            'nama_pegawai', 'nip_pegawai', 'email_pegawai', 'no_hp_pegawai', 'jabatan_pegawai',
            'uraian_kegiatan',
            'link_bukti', 'keterangan',
        )
        read_only_fields = ('id',)

    def validate(self, data):
        periode = data.get('periode') or (self.instance and self.instance.periode)
        if periode and periode.status == PeriodeKinerja.Status.DITUTUP:
            raise serializers.ValidationError(
                'Periode ini sudah ditutup, tidak bisa menambah/mengubah kinerja.'
            )
        return data


class PublicKinerjaSerializer(serializers.Serializer):
    """Serializer untuk form publik pengisian kinerja (tanpa login)."""
    nama_pegawai = serializers.CharField(max_length=200)
    nip_pegawai = serializers.CharField(max_length=20)
    email_pegawai = serializers.EmailField(max_length=254, required=False, allow_blank=True)
    no_hp_pegawai = serializers.CharField(max_length=20, required=False, allow_blank=True)
    jabatan_pegawai = serializers.CharField(max_length=200, required=False, allow_blank=True)
    tanggal = serializers.DateField()
    uraian_kegiatan = serializers.CharField()
    link_bukti = serializers.URLField(max_length=500, required=False, allow_blank=True)
    keterangan = serializers.CharField(required=False, allow_blank=True)
    captcha_token = serializers.CharField(write_only=True, required=True)
    captcha_answer = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        from apps.accounts.captcha import verify_captcha
        captcha_token = attrs.pop('captcha_token', None)
        captcha_answer = attrs.pop('captcha_answer', None)
        if not verify_captcha(captcha_token, captcha_answer):
            raise serializers.ValidationError({
                'captcha': 'Jawaban verifikasi tidak sesuai. Muat ulang dan coba lagi.',
            })
        return attrs


class PublicPeriodeInfoSerializer(serializers.ModelSerializer):
    """Info periode untuk ditampilkan di form publik."""

    class Meta:
        model = PeriodeKinerja
        fields = ('id', 'nama', 'bulan', 'tahun', 'bidang', 'deskripsi', 'status')


class LaporanPegawaiSerializer(serializers.Serializer):
    """Serializer untuk laporan kinerja per pegawai."""
    nip_pegawai = serializers.CharField()
    nama_pegawai = serializers.CharField()
    total_kegiatan = serializers.IntegerField()
    entries = KinerjaHarianSerializer(many=True)
