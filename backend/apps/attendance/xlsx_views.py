from io import BytesIO

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ParseError
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrSuperAdmin
from apps.events.models import Event
from .xlsx import MAX_BYTES, MIME, XlsxError, apply_rows, preview, read_rows, read_json_rows, workbook_bytes


class BoundedJSONParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        content = stream.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise ParseError('Ukuran JSON maksimal 5 MB.')
        return super().parse(BytesIO(content), media_type, parser_context)


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
    parser_classes = [MultiPartParser, FormParser, BoundedJSONParser]

    def post(self, request, event_id):
        event = self.event(event_id)
        result = {'rows': [], 'created': 0, 'updated': 0, 'errors': [], 'dry_run': True}
        try:
            data = request.data
            is_json = request.content_type.split(';')[0] == 'application/json'
            if not isinstance(data, dict):
                raise XlsxError('Payload harus berupa object JSON dengan rows dan dry_run.')
            value = data.get('dry_run', True if is_json else 'true')
            if is_json:
                if type(value) is not bool:
                    raise XlsxError('dry_run JSON harus boolean true atau false.')
                dry_run = value
            else:
                if value not in ('true', 'false'):
                    raise XlsxError('dry_run harus string true atau false.')
                dry_run = value != 'false'
            result['dry_run'] = dry_run
            rows = read_json_rows(data) if is_json else read_rows(request.FILES.get('file'))
            if not dry_run and not rows:
                raise XlsxError('Batch konfirmasi tidak boleh kosong; sisakan minimal satu baris valid.')
        except (XlsxError, ParseError) as exc:
            result['errors'] = [{'row': None, 'column': None, 'message': str(exc), 'hint': 'Periksa nilai baris, format dan batas keamanan impor.'}]
            return Response(result, status=400)
        if dry_run:
            result = preview(event, rows, True)
        else:
            try:
                with transaction.atomic():
                    # Serialize concurrent imports; validate again, never trust client IDs.
                    event = get_object_or_404(Event.objects.select_for_update(), pk=event_id)
                    result = preview(event, rows, False)
                    if not result['errors']:
                        apply_rows(event, result)
            except IntegrityError:
                result = preview(event, rows, False)
                result['errors'].append({'row': None, 'column': None, 'message': 'Data berubah/konflik saat impor. Ulangi preview; tidak ada data yang disimpan.', 'hint': 'Periksa identitas peserta dan ulangi preview.'})
        return Response(result, status=400 if result['errors'] else 200)
