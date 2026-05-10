from django.contrib import admin
from .models import Certificate, CertificateNumberFormat


@admin.register(CertificateNumberFormat)
class CertificateNumberFormatAdmin(admin.ModelAdmin):
    list_display = ('name', 'pattern', 'is_default', 'use_global_counter', 'last_sequence')
    list_filter = ('is_default', 'use_global_counter')
    search_fields = ('name', 'pattern')


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ('certificate_number', 'participant', 'event', 'source', 'status', 'generated_at')
    list_filter = ('status', 'source', 'event')
    search_fields = (
        'certificate_number',
        'participant__full_name',
        'participant__identity_number',
    )
