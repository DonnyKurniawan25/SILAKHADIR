"""Endpoint Laporan Kegiatan (notulen, foto, link, lampiran)."""
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedStaff
from apps.events.models import Event

from .exports import build_report_docx, build_report_pdf
from .models import (
    EventReport, EventReportAttachment, EventReportLink, EventReportPhoto,
)
from .serializers import (
    AttachmentSerializer, EventReportSerializer, LinkSerializer, PhotoSerializer,
)


def _get_or_create_report(event, user=None):
    report, _ = EventReport.objects.get_or_create(
        event=event,
        defaults={'created_by': user if user and user.is_authenticated else None},
    )
    return report


class EventReportView(APIView):
    """GET & PUT laporan utama (summary/notulen/outcome)."""
    permission_classes = [IsAuthenticatedStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        report = _get_or_create_report(event, request.user)
        return Response(EventReportSerializer(report, context={'request': request}).data)

    def put(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        report = _get_or_create_report(event, request.user)
        allowed = ('summary', 'notulen', 'outcome', 'author_name', 'author_position')
        for k in allowed:
            if k in request.data:
                setattr(report, k, request.data.get(k) or '')
        # Cover image (file upload)
        if 'cover_image' in request.FILES:
            report.cover_image = request.FILES['cover_image']
        report.save()
        return Response(EventReportSerializer(report, context={'request': request}).data)


class EventReportPhotosView(APIView):
    """POST untuk tambah foto (bisa multiple)."""
    permission_classes = [IsAuthenticatedStaff]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        report = _get_or_create_report(event, request.user)
        files = request.FILES.getlist('files') \
                or request.FILES.getlist('files[]') \
                or ([request.FILES['image']] if 'image' in request.FILES else [])
        if not files:
            return Response({'detail': 'Minimal satu gambar wajib diunggah.'},
                            status=status.HTTP_400_BAD_REQUEST)
        captions = (request.data.getlist('captions')
                    if hasattr(request.data, 'getlist') else [])
        order_start = report.photos.count()
        created = []
        for i, f in enumerate(files):
            if not (f.content_type or '').startswith('image/'):
                continue
            if f.size > 10 * 1024 * 1024:
                continue
            caption = captions[i] if i < len(captions) else ''
            created.append(EventReportPhoto.objects.create(
                report=report, image=f, caption=caption, order=order_start + i,
            ))
        return Response(
            PhotoSerializer(created, many=True, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class EventReportPhotoDetailView(APIView):
    permission_classes = [IsAuthenticatedStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, event_id, photo_id):
        event = get_object_or_404(Event, id=event_id)
        photo = get_object_or_404(EventReportPhoto, id=photo_id, report__event=event)
        if 'caption' in request.data:
            photo.caption = request.data.get('caption') or ''
            photo.save(update_fields=['caption'])
        return Response(PhotoSerializer(photo, context={'request': request}).data)

    def delete(self, request, event_id, photo_id):
        event = get_object_or_404(Event, id=event_id)
        photo = get_object_or_404(EventReportPhoto, id=photo_id, report__event=event)
        photo.image.delete(save=False)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventReportLinksView(APIView):
    permission_classes = [IsAuthenticatedStaff]

    def post(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        report = _get_or_create_report(event, request.user)
        serializer = LinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(report=report, order=report.links.count())
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EventReportLinkDetailView(APIView):
    permission_classes = [IsAuthenticatedStaff]

    def put(self, request, event_id, link_id):
        event = get_object_or_404(Event, id=event_id)
        link = get_object_or_404(EventReportLink, id=link_id, report__event=event)
        serializer = LinkSerializer(link, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, event_id, link_id):
        event = get_object_or_404(Event, id=event_id)
        link = get_object_or_404(EventReportLink, id=link_id, report__event=event)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventReportAttachmentsView(APIView):
    permission_classes = [IsAuthenticatedStaff]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        report = _get_or_create_report(event, request.user)
        label = (request.data.get('label') or '').strip()
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'file wajib diunggah.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if f.size > 25 * 1024 * 1024:
            return Response({'detail': 'Ukuran berkas maksimal 25MB.'},
                            status=status.HTTP_400_BAD_REQUEST)
        att = EventReportAttachment.objects.create(
            report=report, file=f, label=label or f.name,
            order=report.attachments.count(),
        )
        return Response(
            AttachmentSerializer(att, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class EventReportAttachmentDetailView(APIView):
    permission_classes = [IsAuthenticatedStaff]

    def patch(self, request, event_id, att_id):
        event = get_object_or_404(Event, id=event_id)
        att = get_object_or_404(EventReportAttachment, id=att_id, report__event=event)
        if 'label' in request.data:
            att.label = request.data.get('label') or att.label
            att.save(update_fields=['label'])
        return Response(AttachmentSerializer(att, context={'request': request}).data)

    def delete(self, request, event_id, att_id):
        event = get_object_or_404(Event, id=event_id)
        att = get_object_or_404(EventReportAttachment, id=att_id, report__event=event)
        att.file.delete(save=False)
        att.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicEventReportView(APIView):
    """Laporan kegiatan versi publik (diakses via slug)."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        event = get_object_or_404(Event, public_slug=slug)
        try:
            report = event.report
        except EventReport.DoesNotExist:
            return Response({'found': False})
        data = EventReportSerializer(report, context={'request': request}).data
        data['event'] = {
            'title': event.title,
            'theme': event.theme,
            'start_date': event.start_date,
            'end_date': event.end_date,
            'location': event.location,
            'organizer': event.organizer,
        }
        data['found'] = True
        return Response(data)


def _safe_filename(title: str) -> str:
    import re
    return re.sub(r'[^A-Za-z0-9\-_]+', '-', (title or 'laporan'))[:60].strip('-')


class EventReportExportView(APIView):
    """Download laporan dalam format DOCX atau PDF.

    GET /api/events/{event_id}/report/export/?type=docx|pdf
    """
    permission_classes = [IsAuthenticatedStaff]

    def get(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        report = _get_or_create_report(event, request.user)

        # Pakai 'type' (bukan 'format') agar tidak bentrok dengan content
        # negotiation DRF.
        fmt = (request.GET.get('type') or 'pdf').lower()
        safe_name = _safe_filename(event.title)

        try:
            if fmt == 'docx':
                content = build_report_docx(report)
                resp = HttpResponse(
                    content,
                    content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                )
                resp['Content-Disposition'] = f'attachment; filename="laporan-{safe_name}.docx"'
                return resp
            # default pdf
            content = build_report_pdf(report)
            resp = HttpResponse(content, content_type='application/pdf')
            resp['Content-Disposition'] = f'attachment; filename="laporan-{safe_name}.pdf"'
            return resp
        except ImportError as exc:
            return Response({
                'detail': (
                    f'Library export belum terpasang: {exc}. '
                    'Jalankan `pip install -r requirements.txt` di virtualenv backend.'
                ),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as exc:
            return Response({'detail': f'Gagal menghasilkan berkas: {exc}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
