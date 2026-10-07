import warnings

from PIL import Image, UnidentifiedImageError
from django.conf import settings
from rest_framework import serializers

from .models import Event


class ThumbnailURLMixin:
    def get_thumbnail_url(self, obj):
        url = obj.thumbnail_url
        request = self.context.get('request')
        return request.build_absolute_uri(url) if url and request else url


class EventThumbnailUploadSerializer(serializers.Serializer):
    thumbnail = serializers.FileField(allow_empty_file=False)

    def validate_thumbnail(self, upload):
        if upload.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Ukuran foto maksimal 5 MB.')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(upload) as image:
                    if image.format not in ('PNG', 'JPEG', 'WEBP'):
                        raise serializers.ValidationError('Foto harus berformat PNG, JPEG, atau WebP; SVG tidak diizinkan.')
                    width, height = image.size
                    if not (1 <= width <= 4096 and 1 <= height <= 4096):
                        raise serializers.ValidationError('Dimensi foto harus antara 1 dan 4096 piksel pada setiap sisi.')
                    upload.thumbnail_format = image.format
                    image.verify()
                upload.seek(0)
                # verify() alone does not decode JPEG/WebP pixel data.
                with Image.open(upload) as image:
                    image.load()
        except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
                Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise serializers.ValidationError('Berkas foto rusak atau bukan gambar yang valid.')
        finally:
            upload.seek(0)
        return upload


class EventSerializer(ThumbnailURLMixin, serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    total_participants = serializers.SerializerMethodField()
    total_attended = serializers.SerializerMethodField()
    total_certificates = serializers.SerializerMethodField()
    attendance_link = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            'id', 'title', 'theme', 'description', 'thumbnail_url',
            'start_date', 'end_date', 'location', 'organizer',
            'status', 'status_display', 'attendance_open',
            'certificate_template', 'public_slug',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'total_participants', 'total_attended', 'total_certificates',
            'attendance_link',
        )
        read_only_fields = ('id', 'public_slug', 'created_by', 'created_at', 'updated_at')

    def get_total_participants(self, obj):
        return obj.participants.count()

    def get_total_attended(self, obj):
        return obj.attendances.filter(status='hadir').count()

    def get_total_certificates(self, obj):
        return obj.certificates.count()

    def get_attendance_link(self, obj):
        return f'{settings.FRONTEND_URL}/absensi/{obj.public_slug}'


class EventPublicSerializer(ThumbnailURLMixin, serializers.ModelSerializer):
    """Serializer untuk tampilan publik info kegiatan (di form absensi)."""

    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            'id', 'title', 'theme', 'description', 'thumbnail_url', 'start_date',
            'end_date', 'location', 'organizer', 'status', 'attendance_open',
        )
