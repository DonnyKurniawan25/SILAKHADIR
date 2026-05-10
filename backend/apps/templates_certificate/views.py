from rest_framework import viewsets

from apps.accounts.permissions import IsAdminOrSuperAdmin

from .models import CertificateTemplate
from .serializers import CertificateTemplateSerializer


class CertificateTemplateViewSet(viewsets.ModelViewSet):
    queryset = CertificateTemplate.objects.all()
    serializer_class = CertificateTemplateSerializer
    permission_classes = [IsAdminOrSuperAdmin]
    search_fields = ['name', 'signer_name']
