from django.contrib import admin
from .models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('participant', 'event', 'status', 'attendance_time')
    list_filter = ('status', 'event')
    readonly_fields = ('feedback',)
    search_fields = ('participant__full_name', 'participant__nik', 'participant__nip')
