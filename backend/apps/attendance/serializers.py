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

    identity_type = serializers.ChoiceField(choices=Participant.IdentityType.choices)
    identity_number = serializers.CharField(max_length=32)
    full_name = serializers.CharField(max_length=200)
    institution = serializers.CharField(max_length=200, allow_blank=True, required=False)
    position = serializers.CharField(max_length=150, allow_blank=True, required=False)
    phone = serializers.CharField(max_length=20, allow_blank=True, required=False)
    email = serializers.EmailField(allow_blank=True, required=False)

    signature = Base64ImageField(required=False, allow_null=True)
    photo = Base64ImageField(required=False, allow_null=True)

    captcha_token = serializers.CharField(required=True, write_only=True)
    captcha_answer = serializers.CharField(required=True, write_only=True)

    def validate_identity_number(self, value):
        value = (value or '').strip()
        if not value.isdigit():
            raise serializers.ValidationError('Nomor identitas harus berupa angka.')
        return value

    def validate(self, attrs):
        # Verifikasi captcha terlebih dahulu
        if not verify_captcha(attrs.pop('captcha_token', None),
                              attrs.pop('captcha_answer', None)):
            raise serializers.ValidationError({
                'captcha': 'Jawaban verifikasi tidak sesuai. Muat ulang dan coba lagi.',
            })
        itype = attrs['identity_type']
        number = attrs['identity_number']
        if itype == Participant.IdentityType.NIK and len(number) < 16:
            raise serializers.ValidationError({'identity_number': 'NIK minimal 16 digit.'})
        if itype == Participant.IdentityType.NIP and len(number) < 18:
            raise serializers.ValidationError({'identity_number': 'NIP minimal 18 digit.'})
        if not attrs.get('full_name', '').strip():
            raise serializers.ValidationError({'full_name': 'Nama wajib diisi.'})
        return attrs


class AttendanceSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    identity_number = serializers.CharField(source='participant.identity_number', read_only=True)

    class Meta:
        model = Attendance
        fields = (
            'id', 'event', 'participant', 'participant_name', 'identity_number',
            'attendance_time', 'status', 'ip_address', 'user_agent',
            'signature', 'photo',
        )
        read_only_fields = ('id', 'event', 'attendance_time', 'ip_address', 'user_agent')
