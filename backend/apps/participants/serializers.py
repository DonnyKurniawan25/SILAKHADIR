from rest_framework import serializers

from .models import Participant


class ParticipantSerializer(serializers.ModelSerializer):
    attendance_status = serializers.SerializerMethodField()
    attendance_time = serializers.SerializerMethodField()
    certificate_status = serializers.SerializerMethodField()

    class Meta:
        model = Participant
        fields = (
            'id', 'event', 'nik', 'nip', 'is_asn', 'full_name',
            'institution', 'position', 'phone', 'email',
            'attendance_status', 'attendance_time', 'certificate_status',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'created_at', 'updated_at')

    def validate_nik(self, value):
        value = (value or '').strip()
        if not value.isdigit():
            raise serializers.ValidationError('NIK harus berupa angka.')
        if len(value) != 16:
            raise serializers.ValidationError('NIK harus 16 digit.')
        return value

    def validate_nip(self, value):
        if not value:
            return value
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError('NIP harus berupa angka.')
        if len(value) != 18:
            raise serializers.ValidationError('NIP harus 18 digit.')
        return value

    def validate(self, attrs):
        if 'is_asn' in attrs:
            is_asn = attrs['is_asn']
        else:
            is_asn = getattr(self.instance, 'is_asn', False)

        if 'nip' in attrs:
            nip = attrs['nip']
        else:
            nip = getattr(self.instance, 'nip', '')

        if is_asn and not nip:
            raise serializers.ValidationError({
                'nip': 'NIP wajib diisi untuk peserta ASN.'
            })
        if not is_asn:
            attrs['nip'] = ''
        elif nip:
            attrs['is_asn'] = True
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
