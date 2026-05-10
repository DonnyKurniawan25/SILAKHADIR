from rest_framework import serializers

from .models import CertificateTemplate


class CertificateTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificateTemplate
        fields = '__all__'
