import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsAdminOrSuperAdmin,
    IsAuthenticatedStaff,
    IsEventOwnerOrAdmin,
)

from .models import Event
from .serializers import EventSerializer, EventThumbnailUploadSerializer


logger = logging.getLogger(__name__)


def delete_thumbnail(storage, name):
    try:
        storage.delete(name)
    except Exception:
        logger.exception('Could not remove event thumbnail %s', name)


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.select_related('created_by', 'certificate_template')
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticatedStaff, IsEventOwnerOrAdmin]
    search_fields = ['title', 'theme', 'organizer', 'location']
    filterset_fields = ['status', 'attendance_open']
    ordering_fields = ['start_date', 'created_at', 'title']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Operator hanya bisa melihat kegiatan yang ia buat
        if user.is_authenticated and user.is_operator():
            qs = qs.filter(created_by=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='thumbnail',
            permission_classes=[IsAdminOrSuperAdmin],
            parser_classes=[MultiPartParser, FormParser])
    def thumbnail(self, request, pk=None):
        self.get_object()
        serializer = EventThumbnailUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data['thumbnail']
        extension = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}[upload.thumbnail_format]
        storage = Event._meta.get_field('thumbnail').storage
        new_name = None
        try:
            with transaction.atomic():
                event = Event.objects.select_for_update().get(pk=pk)
                previous = event.thumbnail.name
                # Persist a safe UUID filename, never an untrusted upload extension.
                event.thumbnail.save(f'{uuid.uuid4().hex}.{extension}', upload, save=False)
                new_name = event.thumbnail.name
                event.save(update_fields=['thumbnail', 'updated_at'])
                # Shared-reference-safe cleanup is scheduled by media signals.
        except Exception:
            if new_name:
                delete_thumbnail(storage, new_name)
            raise
        return Response(self.get_serializer(event).data)

    @action(detail=True, methods=['get'], url_path='attendance-link')
    def attendance_link(self, request, pk=None):
        event = self.get_object()
        return Response({
            'slug': event.public_slug,
            'url': f'{settings.FRONTEND_URL}/absensi/{event.public_slug}',
            'qr_value': f'{settings.FRONTEND_URL}/absensi/{event.public_slug}',
            'qr_image_url': request.build_absolute_uri(
                f'/api/public/events/{event.public_slug}/qr/'
            ),
        })

    @action(detail=True, methods=['post'], url_path='close')
    def close_event(self, request, pk=None):
        event = self.get_object()
        event.status = Event.Status.CLOSED
        event.attendance_open = False
        event.save(update_fields=['status', 'attendance_open', 'updated_at'])
        return Response(EventSerializer(event, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='finish')
    def finish_event(self, request, pk=None):
        event = self.get_object()
        event.status = Event.Status.DONE
        event.attendance_open = False
        event.save(update_fields=['status', 'attendance_open', 'updated_at'])
        return Response(EventSerializer(event, context={'request': request}).data)
