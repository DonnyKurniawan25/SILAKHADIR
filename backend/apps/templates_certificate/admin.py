from django.contrib import admin
from .models import CertificateTemplate


@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'signer_name', 'signer_position', 'is_active')
    list_filter = ('is_active',)
