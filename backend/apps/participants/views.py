import io

import openpyxl
from django.db import IntegrityError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedStaff
from apps.events.models import Event

from .models import Participant
from .serializers import ParticipantSerializer


def _find_participant_by_identity(nik='', nip=''):
    nik = (nik or '').strip()
    nip = (nip or '').strip()
    if not nik and not nip:
        return {'found': False}

    qs = Participant.objects.all().order_by('-created_at')
    match = None
    if nik and nip:
        match = qs.filter(nik=nik, nip=nip).first()
    if not match and nik:
        match = qs.filter(nik=nik).first()
    if not match and nip:
        match = qs.filter(nip=nip).first()

    if match:
        return {
            'found': True,
            'full_name': match.full_name or '',
            'nik': match.nik or '',
            'nip': match.nip or '',
            'is_asn': bool(match.is_asn or match.nip),
            'institution': match.institution or '',
            'position': match.position or '',
            'phone': match.phone or '',
            'email': match.email or '',
        }

    if nip:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_match = User.objects.filter(nip=nip).first()
        if user_match:
            return {
                'found': True,
                'full_name': user_match.get_full_name() or user_match.username,
                'nik': '',
                'nip': user_match.nip or '',
                'is_asn': True,
                'institution': getattr(user_match, 'institution', '') or 'Pemerintah Kabupaten Lombok Barat',
                'position': getattr(user_match, 'jabatan', '') or '',
                'phone': getattr(user_match, 'phone', '') or '',
                'email': user_match.email or '',
            }

    return {'found': False}


class EventParticipantViewSet(viewsets.ModelViewSet):
    serializer_class = ParticipantSerializer
    permission_classes = [IsAuthenticatedStaff]
    search_fields = ['full_name', 'nik', 'nip', 'institution', 'email']
    filterset_fields = ['is_asn']

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request, *args, **kwargs):
        res = _find_participant_by_identity(
            nik=request.query_params.get('nik'),
            nip=request.query_params.get('nip'),
        )
        return Response(res)

    def get_queryset(self):
        event_id = self.kwargs.get('event_id')
        return (
            Participant.objects
            .filter(event_id=event_id)
            .select_related('event')
            .prefetch_related('attendances', 'certificates')
        )

    def _get_event(self):
        return get_object_or_404(Event, id=self.kwargs['event_id'])

    def perform_create(self, serializer):
        event = self._get_event()
        nik = (serializer.validated_data.get('nik') or '').strip()
        nip = (serializer.validated_data.get('nip') or '').strip()
        if nik and Participant.objects.filter(event=event, nik=nik).exists():
            raise ValidationError({
                'nik': f'Peserta dengan NIK {nik} sudah terdaftar pada kegiatan ini.'
            })
        if nip and Participant.objects.filter(event=event, nip=nip).exists():
            raise ValidationError({
                'nip': f'Peserta dengan NIP {nip} sudah terdaftar pada kegiatan ini.'
            })
        try:
            serializer.save(event=event)
        except IntegrityError:
            raise ValidationError({
                'detail': 'Peserta dengan NIK atau NIP ini sudah terdaftar pada kegiatan ini.'
            })

    @action(detail=False, methods=['post'], url_path='import-excel',
            parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request, event_id=None):
        event = self._get_event()
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'File Excel wajib diunggah.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            wb = openpyxl.load_workbook(file, data_only=True)
            ws = wb.active
            headers = [str(c.value or '').strip().lower() for c in ws[1]]
            required = {'nik', 'full_name'}
            if not required.issubset(set(headers)):
                return Response({
                    'detail': f'Header wajib: {", ".join(sorted(required))}',
                }, status=status.HTTP_400_BAD_REQUEST)

            created, skipped, errors = 0, 0, []
            for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                data = dict(zip(headers, row))
                nik = str(data.get('nik') or '').strip()
                if not nik:
                    continue
                exists = Participant.objects.filter(
                    event=event, nik=nik
                ).exists()
                if exists:
                    skipped += 1
                    continue
                nip = str(data.get('nip') or '').strip()
                is_asn = str(data.get('is_asn') or '').strip().lower() in ('true', '1', 'yes')
                if not is_asn and nip:
                    is_asn = True
                try:
                    Participant.objects.create(
                        event=event,
                        nik=nik,
                        nip=nip,
                        is_asn=is_asn,
                        full_name=data.get('full_name') or '',
                        institution=data.get('institution') or '',
                        position=data.get('position') or '',
                        phone=str(data.get('phone') or ''),
                        email=data.get('email') or '',
                    )
                    created += 1
                except Exception as exc:
                    errors.append({'row': i, 'error': str(exc)})
            return Response({
                'created': created, 'skipped': skipped, 'errors': errors,
            })
        except Exception as exc:
            return Response({'detail': f'Gagal membaca file: {exc}'},
                            status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request, event_id=None):
        event = self._get_event()
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Peserta'
        ws.append([
            'nik', 'nip', 'is_asn', 'full_name', 'institution',
            'position', 'phone', 'email', 'attendance_status', 'attendance_time',
        ])
        for p in self.get_queryset():
            att = p.attendances.first()
            ws.append([
                p.nik,
                p.nip,
                p.is_asn,
                p.full_name,
                p.institution,
                p.position,
                p.phone,
                p.email,
                att.status if att else 'belum_hadir',
                att.attendance_time.strftime('%Y-%m-%d %H:%M:%S') if att else '',
            ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        filename = f'peserta-{event.public_slug}.xlsx'
        resp = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp


class ParticipantViewSet(viewsets.ModelViewSet):
    """Endpoint flat /api/participants/{id}/ untuk edit/hapus satu peserta."""
    queryset = Participant.objects.select_related('event')
    serializer_class = ParticipantSerializer
    permission_classes = [IsAuthenticatedStaff]

    def perform_update(self, serializer):
        instance = serializer.instance
        event = instance.event
        nik = (serializer.validated_data.get('nik') or '').strip()
        nip = (serializer.validated_data.get('nip') or '').strip()
        if nik and Participant.objects.filter(event=event, nik=nik).exclude(id=instance.id).exists():
            raise ValidationError({
                'nik': f'Peserta dengan NIK {nik} sudah terdaftar pada kegiatan ini.'
            })
        if nip and Participant.objects.filter(event=event, nip=nip).exclude(id=instance.id).exists():
            raise ValidationError({
                'nip': f'Peserta dengan NIP {nip} sudah terdaftar pada kegiatan ini.'
            })
        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({
                'detail': 'Peserta dengan NIK atau NIP ini sudah terdaftar pada kegiatan ini.'
            })

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request, *args, **kwargs):
        res = _find_participant_by_identity(
            nik=request.query_params.get('nik'),
            nip=request.query_params.get('nip'),
        )
        return Response(res)
