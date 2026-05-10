from django.conf import settings
from rest_framework import serializers

from .models import Event


class EventSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    total_participants = serializers.SerializerMethodField()
    total_attended = serializers.SerializerMethodField()
    total_certificates = serializers.SerializerMethodField()
    attendance_link = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            'id', 'title', 'theme', 'description',
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


class EventPublicSerializer(serializers.ModelSerializer):
    """Serializer untuk tampilan publik info kegiatan (di form absensi)."""

    class Meta:
        model = Event
        fields = (
            'id', 'title', 'theme', 'description', 'start_date',
            'end_date', 'location', 'organizer', 'status', 'attendance_open',
        )
