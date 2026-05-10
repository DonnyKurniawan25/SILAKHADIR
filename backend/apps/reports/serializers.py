from rest_framework import serializers

from .models import (
    EventReport, EventReportAttachment, EventReportLink, EventReportPhoto,
)


class PhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = EventReportPhoto
        fields = ('id', 'image', 'image_url', 'caption', 'order', 'created_at')
        read_only_fields = ('id', 'created_at', 'image_url')

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class LinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventReportLink
        fields = ('id', 'label', 'url', 'source', 'order', 'created_at')
        read_only_fields = ('id', 'created_at')


class AttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()

    class Meta:
        model = EventReportAttachment
        fields = (
            'id', 'label', 'file', 'file_url', 'file_name', 'file_size',
            'order', 'created_at',
        )
        read_only_fields = ('id', 'created_at', 'file_url', 'file_name', 'file_size')

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def get_file_name(self, obj):
        if not obj.file:
            return None
        import os
        return os.path.basename(obj.file.name)

    def get_file_size(self, obj):
        try:
            return obj.file.size
        except Exception:
            return None


class EventReportSerializer(serializers.ModelSerializer):
    photos = PhotoSerializer(many=True, read_only=True)
    links = LinkSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = EventReport
        fields = (
            'id', 'event', 'event_title',
            'summary', 'notulen', 'outcome',
            'cover_image', 'cover_image_url',
            'author_name', 'author_position',
            'photos', 'links', 'attachments',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'created_at', 'updated_at')

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get('request')
        url = obj.cover_image.url
        return request.build_absolute_uri(url) if request else url
