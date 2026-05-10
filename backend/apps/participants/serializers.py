from rest_framework import serializers

from .models import Participant


class ParticipantSerializer(serializers.ModelSerializer):
    attendance_status = serializers.SerializerMethodField()
    attendance_time = serializers.SerializerMethodField()
    certificate_status = serializers.SerializerMethodField()

    class Meta:
        model = Participant
        fields = (
            'id', 'event', 'identity_type', 'identity_number', 'full_name',
            'institution', 'position', 'phone', 'email',
            'attendance_status', 'attendance_time', 'certificate_status',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'created_at', 'updated_at')

    def validate_identity_number(self, value):
        value = (value or '').strip()
        if not value.isdigit():
            raise serializers.ValidationError('Nomor identitas harus berupa angka.')
        return value

    def validate(self, attrs):
        itype = attrs.get('identity_type') or getattr(self.instance, 'identity_type', 'NIK')
        number = attrs.get('identity_number') or getattr(self.instance, 'identity_number', '')
        if itype == Participant.IdentityType.NIK and len(number) < 16:
            raise serializers.ValidationError({
                'identity_number': 'NIK minimal 16 digit.'
            })
        if itype == Participant.IdentityType.NIP and len(number) < 18:
            raise serializers.ValidationError({
                'identity_number': 'NIP minimal 18 digit.'
            })
        return attrs

    def _attendance(self, obj):
        return getattr(obj, '_cached_attendance', None) or obj.attendances.first()

    def get_attendance_status(self, obj):
        att = self._attendance(obj)
        return att.status if att else 'belum_hadir'

    def get_attendance_time(self, obj):
        att = self._attendance(obj)
        return att.attendance_time if att else None

    def get_certificate_status(self, obj):
        cert = obj.certificates.first()
        if not cert:
            return 'belum_tersedia'
        return cert.status
