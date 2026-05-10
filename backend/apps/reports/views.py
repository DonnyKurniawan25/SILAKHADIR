import io

import openpyxl
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from apps.accounts.permissions import IsAuthenticatedStaff
from apps.attendance.models import Attendance
from apps.certificates.models import Certificate
from apps.events.models import Event
from apps.events.serializers import EventSerializer
from apps.participants.models import Participant


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs_events = Event.objects.all()
        user = request.user
        if user.is_authenticated and user.is_operator():
            qs_events = qs_events.filter(created_by=user)

        total_events = qs_events.count()
        total_participants = Participant.objects.filter(event__in=qs_events).count()
        total_attended = Attendance.objects.filter(
            event__in=qs_events, status=Attendance.Status.HADIR
        ).count()
        total_certificates = Certificate.objects.filter(event__in=qs_events).count()

        # Grafik peserta per kegiatan (top 10 terbaru)
        by_event = (
            qs_events.order_by('-start_date')[:10]
            .annotate(
                participants_count=Count('participants', distinct=True),
                attended_count=Count(
                    'attendances',
                    filter=Q(attendances__status=Attendance.Status.HADIR),
                    distinct=True,
                ),
            )
            .values('id', 'title', 'participants_count', 'attended_count')
        )

        # Grafik status kehadiran keseluruhan
        attendance_summary = {
            'hadir': total_attended,
            'belum_hadir': max(total_participants - total_attended, 0),
        }

        # Tabel kegiatan terbaru
        recent = qs_events.order_by('-created_at')[:5]
        recent_data = EventSerializer(recent, many=True, context={'request': request}).data

        return Response({
            'totals': {
                'events': total_events,
                'participants': total_participants,
                'attended': total_attended,
                'certificates': total_certificates,
            },
            'participants_per_event': list(by_event),
            'attendance_summary': attendance_summary,
            'recent_events': recent_data,
        })


class EventReportViewSet(viewsets.ViewSet):
    """Laporan per event: attendance, certificate, export excel/pdf."""
    permission_classes = [IsAuthenticatedStaff]

    def _get_event(self, event_id):
        return get_object_or_404(Event, id=event_id)

    @action(detail=False, methods=['get'], url_path='attendance')
    def attendance_report(self, request, event_id=None):
        event = self._get_event(event_id)
        participants = event.participants.all().prefetch_related('attendances')
        hadir, belum = [], []
        for p in participants:
            att = p.attendances.first()
            item = {
                'identity_number': p.identity_number,
                'full_name': p.full_name,
                'institution': p.institution,
                'position': p.position,
                'time': att.attendance_time if att else None,
            }
            if att and att.status == Attendance.Status.HADIR:
                hadir.append(item)
            else:
                belum.append(item)
        return Response({
            'event': event.title,
            'total': participants.count(),
            'hadir_count': len(hadir),
            'belum_count': len(belum),
            'hadir': hadir,
            'belum_hadir': belum,
        })

    @action(detail=False, methods=['get'], url_path='certificates')
    def certificates_report(self, request, event_id=None):
        event = self._get_event(event_id)
        certs = event.certificates.select_related('participant').all()
        data = [{
            'certificate_number': c.certificate_number,
            'participant_name': c.participant.full_name,
            'identity_number': c.participant.identity_number,
            'status': c.status,
            'generated_at': c.generated_at,
        } for c in certs]
        return Response({
            'event': event.title,
            'total': certs.count(),
            'items': data,
        })

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request, event_id=None):
        event = self._get_event(event_id)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Rekap'
        ws.append(['No', 'Nama', 'NIK/NIP', 'Instansi', 'Jabatan',
                   'Status Hadir', 'Waktu Absen', 'No. Sertifikat'])
        for i, p in enumerate(event.participants.all(), start=1):
            att = p.attendances.first()
            cert = p.certificates.filter(event=event).first()
            ws.append([
                i, p.full_name, p.identity_number, p.institution, p.position,
                att.status if att else 'belum_hadir',
                att.attendance_time.strftime('%Y-%m-%d %H:%M:%S') if att else '',
                cert.certificate_number if cert else '',
            ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        resp = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        resp['Content-Disposition'] = f'attachment; filename="rekap-{event.public_slug}.xlsx"'
        return resp

    @action(detail=False, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request, event_id=None):
        event = self._get_event(event_id)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        c.setFont('Helvetica-Bold', 14)
        c.drawString(20 * mm, height - 20 * mm, f'Rekap Kegiatan: {event.title}')
        c.setFont('Helvetica', 10)
        c.drawString(20 * mm, height - 27 * mm,
                     f'Tanggal: {event.start_date:%d %b %Y} s.d. {event.end_date:%d %b %Y}')
        c.drawString(20 * mm, height - 33 * mm, f'Lokasi: {event.location}')

        y = height - 45 * mm
        c.setFont('Helvetica-Bold', 9)
        c.drawString(20 * mm, y, 'No')
        c.drawString(30 * mm, y, 'Nama')
        c.drawString(85 * mm, y, 'NIK/NIP')
        c.drawString(120 * mm, y, 'Instansi')
        c.drawString(170 * mm, y, 'Hadir')
        y -= 6 * mm
        c.setFont('Helvetica', 9)

        for i, p in enumerate(event.participants.all(), start=1):
            if y < 20 * mm:
                c.showPage()
                y = height - 20 * mm
            att = p.attendances.first()
            c.drawString(20 * mm, y, str(i))
            c.drawString(30 * mm, y, p.full_name[:30])
            c.drawString(85 * mm, y, p.identity_number)
            c.drawString(120 * mm, y, (p.institution or '')[:28])
            c.drawString(170 * mm, y, 'Ya' if att and att.status == 'hadir' else 'Tidak')
            y -= 5 * mm

        c.showPage()
        c.save()
        resp = HttpResponse(buf.getvalue(), content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="rekap-{event.public_slug}.pdf"'
        return resp
