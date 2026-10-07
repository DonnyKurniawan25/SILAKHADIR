from rest_framework import serializers

from .models import Participant


class ParticipantSerializer(serializers.ModelSerializer):
    attendance_status = serializers.SerializerMethodField()
    attendance_time = serializers.SerializerMethodField()
    certificate_status = serializers.SerializerMethodField()
    certificate_history = serializers.SerializerMethodField()

    def get_certificate_history(self, obj):
        from .identity import IdentityRegistry
        # The same serializer instance handles all rows of a ListSerializer.
        if not hasattr(self, '_identity_registry'):
            self._identity_registry = IdentityRegistry()
        return self._identity_registry.participant_history(obj)

    class Meta:
        model = Participant
        fields = (
            'id', 'event', 'nik', 'nip', 'is_asn', 'full_name',
            'institution', 'position', 'phone', 'email',
            'attendance_status', 'attendance_time', 'certificate_status', 'certificate_history',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'created_at', 'updated_at')
        # Nullable storage supports XLSX NIP-only participants, not a change to
        # the existing required-NIK form/API contract.
        extra_kwargs = {'nik': {'required': True, 'allow_blank': False, 'allow_null': False}}

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
        if not cert or not cert.pdf_file:
            return 'belum_tersedia'
        if cert.status == 'tersedia':
            try:
                if not cert.pdf_file.storage.exists(cert.pdf_file.name):
                    return 'belum_tersedia'
            except Exception:
                return 'belum_tersedia'
        return cert.status
