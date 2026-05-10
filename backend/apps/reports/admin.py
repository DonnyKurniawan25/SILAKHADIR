from django.contrib import admin
from .models import (
    EventReport, EventReportAttachment, EventReportLink, EventReportPhoto,
)


class PhotoInline(admin.TabularInline):
    model = EventReportPhoto
    extra = 0


class LinkInline(admin.TabularInline):
    model = EventReportLink
    extra = 0


class AttachmentInline(admin.TabularInline):
    model = EventReportAttachment
    extra = 0


@admin.register(EventReport)
class EventReportAdmin(admin.ModelAdmin):
    list_display = ('event', 'author_name', 'updated_at')
    search_fields = ('event__title', 'author_name')
    inlines = [PhotoInline, LinkInline, AttachmentInline]


admin.site.register(EventReportPhoto)
admin.site.register(EventReportLink)
admin.site.register(EventReportAttachment)
