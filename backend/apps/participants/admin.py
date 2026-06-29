from django.contrib import admin
from .models import Participant


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'nik', 'nip', 'event', 'institution')
    list_filter = ('is_asn', 'event')
    search_fields = ('full_name', 'nik', 'nip', 'institution', 'email')
