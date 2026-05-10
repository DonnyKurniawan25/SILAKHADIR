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
    identity_number = serializers.CharField(source='participant.identity_number', read_only=True)
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
            'participant', 'participant_name', 'identity_number',
            'certificate_number', 'number_format', 'source',
            'status', 'pdf_file', 'qr_code',
            'verification_token', 'download_token',
            'generated_at', 'updated_at',
            'download_url', 'verify_url', 'pdf_url',
        )
        read_only_fields = fields

    def get_download_url(self, obj):
        return f'{settings.BACKEND_URL}/api/public/certificates/download/{obj.download_token}/'

    def get_verify_url(self, obj):
        return f'{settings.FRONTEND_URL}/verifikasi/{obj.verification_token}'

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            url = obj.pdf_file.url
            if request:
                return request.build_absolute_uri(url)
            return f'{settings.BACKEND_URL}{url}'
        return None


class CertificatePublicSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_start = serializers.DateTimeField(source='event.start_date', read_only=True)
    event_end = serializers.DateTimeField(source='event.end_date', read_only=True)
    organizer = serializers.CharField(source='event.organizer', read_only=True)
    download_url = serializers.SerializerMethodField()
    verify_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = (
            'id', 'certificate_number', 'status',
            'participant_name', 'event_title',
            'event_start', 'event_end', 'organizer',
            'download_url', 'verify_url',
        )

    def get_download_url(self, obj):
        return f'{settings.BACKEND_URL}/api/public/certificates/download/{obj.download_token}/'

    def get_verify_url(self, obj):
        return f'{settings.FRONTEND_URL}/verifikasi/{obj.verification_token}'
