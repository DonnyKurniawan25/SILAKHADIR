import base64
import uuid

from django.core.files.base import ContentFile
from rest_framework import serializers

from apps.accounts.captcha import verify_captcha
from apps.participants.models import Participant

from .models import Attendance


class Base64ImageField(serializers.ImageField):
    """Field untuk menerima gambar base64 (misal canvas tanda tangan)."""

    def to_internal_value(self, data):
        if isinstance(data, str) and data.startswith('data:image'):
            header, b64 = data.split(';base64,', 1)
            ext = header.split('/')[-1]
            try:
                decoded = base64.b64decode(b64)
            except Exception:
                raise serializers.ValidationError('Data gambar tidak valid.')
            file_name = f'{uuid.uuid4().hex}.{ext}'
            data = ContentFile(decoded, name=file_name)
        return super().to_internal_value(data)


class PublicAttendanceSerializer(serializers.Serializer):
    """Serializer untuk submit absensi publik dari peserta."""

    nik = serializers.CharField(max_length=16)
    nip = serializers.CharField(max_length=18, allow_blank=True, required=False, default='')
    is_asn = serializers.BooleanField(default=False)
    full_name = serializers.CharField(max_length=200)
    institution = serializers.CharField(max_length=200, allow_blank=True, required=False)
    position = serializers.CharField(max_length=150, allow_blank=True, required=False)
    phone = serializers.CharField(max_length=20, allow_blank=True, required=False)
    email = serializers.EmailField(allow_blank=True, required=False)

    signature = Base64ImageField(required=False, allow_null=True)
    photo = Base64ImageField(required=False, allow_null=True)

    captcha_token = serializers.CharField(required=True, write_only=True)
    captcha_answer = serializers.CharField(required=True, write_only=True)

    def validate_nik(self, value):
        value = (value or '').strip()
        if not value.isdigit():
            raise serializers.ValidationError('NIK harus berupa angka.')
        if len(value) != 16:
            raise serializers.ValidationError('NIK harus 16 digit.')
        return value

    def validate_nip(self, value):
        if not value:
            return ''
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError('NIP harus berupa angka.')
        if len(value) != 18:
            raise serializers.ValidationError('NIP harus 18 digit.')
        return value

    def validate(self, attrs):
        # Verifikasi captcha terlebih dahulu
        if not verify_captcha(attrs.pop('captcha_token', None),
                              attrs.pop('captcha_answer', None)):
            raise serializers.ValidationError({
                'captcha': 'Jawaban verifikasi tidak sesuai. Muat ulang dan coba lagi.',
            })
        is_asn = attrs.get('is_asn', False)
        nip = attrs.get('nip', '')
        if is_asn and not nip:
            raise serializers.ValidationError({'nip': 'NIP wajib diisi untuk ASN.'})
        if not is_asn and nip:
            # Otomatis set is_asn=True jika NIP diisi
            attrs['is_asn'] = True
        if not attrs.get('full_name', '').strip():
            raise serializers.ValidationError({'full_name': 'Nama wajib diisi.'})
        return attrs


class AttendanceSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_nik = serializers.CharField(source='participant.nik', read_only=True)
    participant_nip = serializers.CharField(source='participant.nip', read_only=True)

    class Meta:
        model = Attendance
        fields = (
            'id', 'event', 'participant', 'participant_name',
            'participant_nik', 'participant_nip',
            'attendance_time', 'status', 'ip_address', 'user_agent',
            'signature', 'photo',
        )
        read_only_fields = ('id', 'event', 'attendance_time', 'ip_address', 'user_agent')
