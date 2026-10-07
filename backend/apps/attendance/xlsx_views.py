from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrSuperAdmin
from apps.events.models import Event
from .xlsx import MIME, XlsxError, apply_rows, preview, read_rows, workbook_bytes


class AttendanceXlsxBaseView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def event(self, event_id):
        return get_object_or_404(Event, pk=event_id)

    def download(self, event, template=False):
        response = HttpResponse(workbook_bytes(event, template), content_type=MIME)
        prefix = 'template-absensi' if template else 'absensi'
        response['Content-Disposition'] = f'attachment; filename="{prefix}-{event.pk}.xlsx"'
        response['Cache-Control'] = 'no-store'
        return response


class AttendanceTemplateXlsxView(AttendanceXlsxBaseView):
    def get(self, request, event_id):
        return self.download(self.event(event_id), template=True)


class AttendanceExportXlsxView(AttendanceXlsxBaseView):
    def get(self, request, event_id):
        return self.download(self.event(event_id))


class AttendanceImportXlsxView(AttendanceXlsxBaseView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, event_id):
        event = self.event(event_id)
        value = request.data.get('dry_run', 'true')
        dry_run = value != 'false'
        result = {'rows': [], 'created': 0, 'updated': 0, 'errors': [], 'dry_run': dry_run}
        if value not in ('true', 'false'):
            result['errors'] = [{'row': None, 'column': None, 'message': 'dry_run harus string true atau false.', 'hint': 'Gunakan true untuk preview atau false untuk menyimpan.'}]
            return Response(result, status=400)
        try:
            rows = read_rows(request.FILES.get('file'))
        except XlsxError as exc:
            result['errors'] = [{'row': None, 'column': None, 'message': str(exc), 'hint': 'Periksa format dan keamanan workbook; gunakan template XLSX.'}]
            return Response(result, status=400)
        if dry_run:
            result = preview(event, rows, True)
        else:
            try:
                with transaction.atomic():
                    # Serialize concurrent imports to the same event. Re-check
                    # against current DB state rather than trusting client preview.
                    event = get_object_or_404(Event.objects.select_for_update(), pk=event_id)
                    result = preview(event, rows, False)
                    if not result['errors']:
                        apply_rows(event, result)
            except IntegrityError:
                # All writes were rolled back; do not leak IDs from rolled back rows.
                result = preview(event, rows, False)
                result['errors'].append({'row': None, 'column': None, 'message': 'Data berubah/konflik saat impor. Ulangi preview; tidak ada data yang disimpan.', 'hint': 'Periksa identitas peserta dan ulangi preview.'})
        return Response(result, status=400 if result['errors'] else 200)
