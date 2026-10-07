from django.conf import settings
from rest_framework import serializers

from .models import Certificate, CertificateNumberFormat


class CertificateNumberFormatSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model = CertificateNumberFormat
        fields = (
            'id', 'name', 'pattern', 'description',
            'is_default', 'use_global_counter', 'last_sequence',
            'preview', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'last_sequence', 'created_at', 'updated_at')

    def get_preview(self, obj):
        """Contoh hasil render dengan seq=1 & event 'Contoh Kegiatan'."""
        from django.utils import timezone
        from .utils import render_number_format
        try:
            return render_number_format(
                obj.pattern,
                sequence=1,
                event_title='Contoh Kegiatan',
                when=timezone.now(),
            )
        except Exception as exc:
            return f'[error: {exc}]'


class CertificateSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    nik = serializers.CharField(source='participant.nik', read_only=True)
    nip = serializers.CharField(source='participant.nip', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_start = serializers.DateTimeField(source='event.start_date', read_only=True)
    event_end = serializers.DateTimeField(source='event.end_date', read_only=True)
    download_url = serializers.SerializerMethodField()
    verify_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = (
            'id', 'event', 'event_title', 'event_start', 'event_end',
            'participant', 'participant_name', 'nik', 'nip',
            'certificate_number', 'number_format', 'source',
            'status', 'pdf_file', 'qr_code',
            'verification_token', 'download_token',
            'generated_at', 'updated_at',
            'download_url', 'verify_url', 'pdf_url',
        )
        read_only_fields = fields

    def get_download_url(self, obj):
        return f'{settings.FRONTEND_URL.rstrip("/")}/api/public/certificates/download/{obj.download_token}/'

    def get_verify_url(self, obj):
        return f'{settings.FRONTEND_URL}/verifikasi/{obj.verification_token}'

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            url = obj.pdf_file.url
            return f'{settings.FRONTEND_URL.rstrip("/")}/{url.lstrip("/")}'
        return None


class PublicCertificateLookupSerializer(serializers.Serializer):
    identity = serializers.RegexField(r'\A(?:[0-9]{16}|[0-9]{18})\Z', required=False, allow_blank=True, trim_whitespace=True)
    identity_number = serializers.RegexField(r'\A(?:[0-9]{16}|[0-9]{18})\Z', required=False, allow_blank=True, trim_whitespace=True)
    # Legacy callers used nik for either identity type.
    nik = serializers.RegexField(r'\A(?:[0-9]{16}|[0-9]{18})\Z', required=False, allow_blank=True, trim_whitespace=True)
    nip = serializers.RegexField(r'\A[0-9]{18}\Z', required=False, allow_blank=True, trim_whitespace=True)
    event_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        if not any(attrs.get(key) for key in ('identity', 'identity_number', 'nik', 'nip')):
            raise serializers.ValidationError('NIK (16 digit) atau NIP (18 digit) wajib diisi.')
        return attrs


class CertificatePublicSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_start = serializers.DateTimeField(source='event.start_date', read_only=True)
    event_end = serializers.DateTimeField(source='event.end_date', read_only=True)
    organizer = serializers.CharField(source='event.organizer', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    can_download = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    verify_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = (
            'id', 'certificate_number', 'status',
            'participant_name', 'event_title',
            'event_start', 'event_end', 'organizer', 'thumbnail_url',
            'can_download', 'download_url', 'verify_url',
        )

    def get_thumbnail_url(self, obj):
        thumbnail = getattr(obj.event, 'thumbnail', None)
        if not thumbnail:
            return None
        url = thumbnail.url
        if url.startswith(('http://', 'https://')):
            return url
        return f'{settings.FRONTEND_URL.rstrip("/")}/{url.lstrip("/")}'

    def get_can_download(self, obj):
        from .public import can_download_public_pdf
        if not hasattr(self, '_downloadable'):
            self._downloadable = {}
        if obj.pk not in self._downloadable:
            self._downloadable[obj.pk] = can_download_public_pdf(obj)
        return self._downloadable[obj.pk]

    def get_download_url(self, obj):
        if not self.get_can_download(obj):
            return None
        return f'{settings.FRONTEND_URL.rstrip("/")}/api/public/certificates/download/{obj.download_token}/'

    def get_verify_url(self, obj):
        return f'{settings.FRONTEND_URL}/verifikasi/{obj.verification_token}'
