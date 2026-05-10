from django.contrib import admin
from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'end_date', 'status', 'created_by')
    list_filter = ('status', 'attendance_open')
    search_fields = ('title', 'theme', 'organizer')
    readonly_fields = ('id', 'public_slug', 'created_at', 'updated_at')
