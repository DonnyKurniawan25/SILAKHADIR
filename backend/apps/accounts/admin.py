from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import ActivityLog, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'institution', 'is_active')
    list_filter = ('role', 'is_active', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('SILAKHADIR', {'fields': ('role', 'phone', 'institution')}),
    )


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'target', 'created_at')
    list_filter = ('action',)
    search_fields = ('user__username', 'target', 'description')
