from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from apps.participants.views import EventParticipantViewSet
from apps.certificates.views import EventCertificateViewSet
from apps.reports.views import EventReportViewSet
from apps.reports.report_views import (
    EventReportView,
    EventReportPhotosView,
    EventReportPhotoDetailView,
    EventReportLinksView,
    EventReportLinkDetailView,
    EventReportAttachmentsView,
    EventReportAttachmentDetailView,
    EventReportExportView,
)

from .views import EventViewSet

router = DefaultRouter()
router.register(r'', EventViewSet, basename='event')

# Gunakan SimpleRouter untuk nested routes agar tidak membuat
# API root view di path kosong (yang akan bentrok dengan detail event).
nested_participants = SimpleRouter()
nested_participants.register(
    r'participants', EventParticipantViewSet, basename='event-participant'
)

nested_certificates = SimpleRouter()
nested_certificates.register(
    r'certificates', EventCertificateViewSet, basename='event-certificate'
)

nested_reports = SimpleRouter()
nested_reports.register(r'reports', EventReportViewSet, basename='event-report')


urlpatterns = [
    # Main router dulu agar /api/events/{id}/ (detail) diprioritaskan.
    path('', include(router.urls)),
    path('<uuid:event_id>/', include(nested_participants.urls)),
    path('<uuid:event_id>/', include(nested_certificates.urls)),
    path('<uuid:event_id>/', include(nested_reports.urls)),

    # Laporan kegiatan (notulen/foto/link/lampiran)
    path('<uuid:event_id>/report/', EventReportView.as_view(), name='event-report-detail'),
    path('<uuid:event_id>/report/export/', EventReportExportView.as_view(), name='event-report-export'),
    path('<uuid:event_id>/report/photos/', EventReportPhotosView.as_view(), name='event-report-photos'),
    path('<uuid:event_id>/report/photos/<uuid:photo_id>/',
         EventReportPhotoDetailView.as_view(), name='event-report-photo-detail'),
    path('<uuid:event_id>/report/links/', EventReportLinksView.as_view(), name='event-report-links'),
    path('<uuid:event_id>/report/links/<uuid:link_id>/',
         EventReportLinkDetailView.as_view(), name='event-report-link-detail'),
    path('<uuid:event_id>/report/attachments/',
         EventReportAttachmentsView.as_view(), name='event-report-attachments'),
    path('<uuid:event_id>/report/attachments/<uuid:att_id>/',
         EventReportAttachmentDetailView.as_view(), name='event-report-attachment-detail'),
]
