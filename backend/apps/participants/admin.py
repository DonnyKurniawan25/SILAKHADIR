from django.contrib import admin
from .models import Participant


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'identity_number', 'event', 'institution')
    list_filter = ('identity_type', 'event')
    search_fields = ('full_name', 'identity_number', 'institution', 'email')
