from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import (
    IsAdminOrSuperAdmin,
    IsAuthenticatedStaff,
    IsSuperAdmin,
)
from apps.events.models import Event
from apps.participants.models import Participant


def _guess_name_from_text(text: str) -> str | None:
    """
    Heuristik sederhana: cari baris di dekat 'diberikan kepada' / 'kepada'
    yang kemungkinan adalah nama peserta.
    """
    import re
    if not text:
        return None
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for i, line in enumerate(lines):
        if re.search(r'(?i)(diberikan\s+kepada|kepada|presented\s+to)', line):
            # cari baris berikutnya yang tampak seperti nama (huruf + spasi)
            for j in range(i + 1, min(i + 4, len(lines))):
                cand = lines[j].strip().strip(':').strip()
                if 3 <= len(cand) <= 80 and re.search(r'[A-Za-z]', cand):
                    return cand
    return None

from .models import Certificate, CertificateNumberFormat
from .matcher import (
    extract_certificate_number,
    extract_identity_numbers,
    extract_text_from_pdf,
    find_participant,
)
from .serializers import (
    CertificateNumberFormatSerializer,
    CertificatePublicSerializer,
    CertificateSerializer,
)
from .services import (
    create_or_update_certificate,
    generate_certificates_for_event,
    preview_certificate_number,
)


class CertificateNumberFormatViewSet(viewsets.ModelViewSet):
    """Master format nomor sertifikat. Hanya Super Admin yang dapat mengelola."""
    queryset = CertificateNumberFormat.objects.all()
    serializer_class = CertificateNumberFormatSerializer

    def get_permissions(self):
        # Admin/operator boleh lihat & preview; hanya super admin boleh ubah master.
        if self.action in ('list', 'retrieve', 'preview'):
            return [IsAuthenticatedStaff()]
        return [IsSuperAdmin()]

    @action(detail=True, methods=['post'], url_path='preview')
    def preview(self, request, pk=None):
        """Preview nomor yang akan dihasilkan untuk event tertentu."""
        fmt = self.get_object()
        event_id = request.data.get('event_id')
        sequence = request.data.get('sequence')
        event = get_object_or_404(Event, id=event_id) if event_id else None
        if not event:
            # preview tanpa event: render contoh
            return Response({'preview': CertificateNumberFormatSerializer(fmt).data['preview']})
        try:
            number = preview_certificate_number(
                event, fmt,
                sequence=int(sequence) if sequence is not None else None,
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'preview': number})


class CertificateViewSet(viewsets.ReadOnlyModelViewSet):
    """Listing semua sertifikat oleh admin/operator."""
    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticatedStaff]
    search_fields = [
        'certificate_number',
        'participant__full_name',
        'participant__nik',
        'participant__nip',
        'event__title',
    ]
    filterset_fields = ['status', 'event', 'source']

    def get_queryset(self):
        user = self.request.user
        qs = Certificate.objects.select_related('event', 'participant')
        if user.is_authenticated and user.is_operator():
            if user.nip:
                qs = qs.filter(Q(participant__nip=user.nip) | Q(participant__nik=user.nip))
            else:
                qs = qs.none()
        return qs


class EventCertificateViewSet(viewsets.ReadOnlyModelViewSet):
    """Sertifikat untuk satu event + action generate & upload."""
    serializer_class = CertificateSerializer
    permission_classes = [IsAdminOrSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Certificate.objects.filter(
            event_id=self.kwargs['event_id']
        ).select_related('participant', 'event', 'number_format')

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request, event_id=None):
        event = get_object_or_404(Event, id=event_id)
        regenerate = bool(request.data.get('regenerate', False))
        fmt_id = request.data.get('number_format_id')
        number_format = None
        if fmt_id:
            number_format = get_object_or_404(CertificateNumberFormat, id=fmt_id)
        generated, skipped = generate_certificates_for_event(
            event, regenerate=regenerate, number_format=number_format,
        )
        return Response({
            'generated': len(generated),
            'skipped': len(skipped),
            'regenerate': regenerate,
        })

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request, event_id=None):
        """
        Upload PDF sertifikat untuk seorang peserta.
        Admin mengisi nomor sertifikat dan mengunggah file PDF yang sudah
        ditandatangani. Nomor boleh sama antar sertifikat.

        Payload (multipart/form-data):
        - participant_id     : UUID peserta (opsional jika mengirim data NIK)
        - nik                : NIK (untuk lookup/membuat peserta baru)
        - nip                : NIP (opsional, untuk peserta ASN baru)
        - full_name          : Nama (jika peserta baru)
        - institution, position, phone, email : opsional
        - certificate_number : nomor sertifikat dari admin (required)
        - pdf_file           : file PDF (required)
        """
        event = get_object_or_404(Event, id=event_id)

        participant_id = request.data.get('participant_id')
        if participant_id:
            participant = get_object_or_404(
                Participant, id=participant_id, event=event,
            )
        else:
            # Buat peserta baru kalau admin upload untuk orang yang belum terdaftar
            nik = (request.data.get('nik') or '').strip()
            full_name = (request.data.get('full_name') or '').strip()
            if not nik or not full_name:
                return Response(
                    {'detail': 'participant_id, atau nik + full_name wajib diisi.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            nip = (request.data.get('nip') or '').strip()
            is_asn = bool(nip)
            participant, _ = Participant.objects.get_or_create(
                event=event,
                nik=nik,
                defaults={
                    'nip': nip,
                    'is_asn': is_asn,
                    'full_name': full_name,
                    'institution': request.data.get('institution', ''),
                    'position': request.data.get('position', ''),
                    'phone': request.data.get('phone', ''),
                    'email': request.data.get('email', ''),
                },
            )

        certificate_number = (request.data.get('certificate_number') or '').strip()
        if not certificate_number:
            return Response(
                {'detail': 'Nomor sertifikat wajib diisi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pdf_file = request.FILES.get('pdf_file')
        if not pdf_file:
            return Response(
                {'detail': 'pdf_file wajib diunggah.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not pdf_file.name.lower().endswith('.pdf'):
            return Response(
                {'detail': 'File harus berformat PDF.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pdf_file.size > 20 * 1024 * 1024:
            return Response(
                {'detail': 'Ukuran file maksimal 20MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cert = create_or_update_certificate(
                event=event,
                participant=participant,
                pdf_file=pdf_file,
                custom_number=certificate_number,
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            CertificateSerializer(cert, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request, event_id=None):
        """
        Upload banyak PDF sekaligus. Sistem membaca isi setiap PDF lalu
        mencocokkan dengan peserta berdasarkan nama, dan mengekstrak nomor
        sertifikat dari teks PDF.

        Payload (multipart/form-data):
        - files[]    : multiple PDF files (required)
        - dry_run    : 'true' untuk hanya preview tanpa menyimpan
        - create_missing : 'true' untuk otomatis tambah peserta baru jika
                           ditemukan NIK di PDF yang belum terdaftar (default: false)
        """
        event = get_object_or_404(Event, id=event_id)
        files = request.FILES.getlist('files') or request.FILES.getlist('files[]')
        if not files:
            return Response(
                {'detail': 'files wajib diunggah (multiple).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dry_run = str(request.data.get('dry_run', 'false')).lower() == 'true'
        create_missing = str(request.data.get('create_missing', 'false')).lower() == 'true'

        participants = list(event.participants.all())

        results = []
        ok_count = 0
        fail_count = 0

        for f in files:
            item = {
                'filename': f.name,
                'matched_participant': None,
                'matched_score': 0,
                'certificate_number': None,
                'identity_numbers_in_pdf': [],
                'status': 'pending',
                'message': '',
                'certificate_id': None,
            }

            # Validasi file
            if not f.name.lower().endswith('.pdf'):
                item['status'] = 'failed'
                item['message'] = 'Bukan file PDF.'
                fail_count += 1
                results.append(item)
                continue
            if f.size > 20 * 1024 * 1024:
                item['status'] = 'failed'
                item['message'] = 'Ukuran melebihi 20MB.'
                fail_count += 1
                results.append(item)
                continue

            try:
                text = extract_text_from_pdf(f)
            except Exception as exc:
                item['status'] = 'failed'
                item['message'] = f'Gagal membaca PDF: {exc}'
                fail_count += 1
                results.append(item)
                continue

            # Ekstrak nomor & NIK dari PDF
            cert_number = extract_certificate_number(text)
            item['certificate_number'] = cert_number

            id_numbers = extract_identity_numbers(text)
            item['identity_numbers_in_pdf'] = id_numbers

            # Match peserta via nama (prioritas), lalu fallback via NIK
            participant, score = find_participant(text, participants)

            if not participant and id_numbers:
                # Coba match by NIK atau NIP
                for idnum in id_numbers:
                    hit = next((p for p in participants if p.nik == idnum or p.nip == idnum), None)
                    if hit:
                        participant = hit
                        score = 1.0
                        break

            if not participant and create_missing and id_numbers:
                # Buat peserta baru hanya jika ditemukan NIK 16 digit.
                idnum = next((n for n in id_numbers if len(n) == 16), None)
                if idnum:
                    nama_guess = _guess_name_from_text(text) or f'Peserta ({idnum})'
                    if not dry_run:
                        participant, _ = Participant.objects.get_or_create(
                            event=event,
                            nik=idnum,
                            defaults={'full_name': nama_guess},
                        )
                        participants.append(participant)
                    else:
                        # dry run -> cukup simulasi
                        item['matched_participant'] = {
                            'new': True,
                            'nik': idnum,
                            'full_name': nama_guess,
                        }

            if participant:
                item['matched_participant'] = {
                    'id': str(participant.id),
                    'full_name': participant.full_name,
                    'nik': participant.nik,
                }
                item['matched_score'] = round(score, 3)

            if not participant:
                item['status'] = 'unmatched'
                item['message'] = 'Tidak ditemukan peserta yang cocok di kegiatan ini.'
                fail_count += 1
                results.append(item)
                continue

            if not cert_number:
                item['status'] = 'no_number'
                item['message'] = 'Nomor sertifikat tidak terdeteksi di PDF.'
                fail_count += 1
                results.append(item)
                continue

            if dry_run:
                item['status'] = 'ready'
                item['message'] = 'Siap di-upload.'
                ok_count += 1
                results.append(item)
                continue

            # Simpan
            try:
                cert = create_or_update_certificate(
                    event=event,
                    participant=participant,
                    pdf_file=f,
                    custom_number=cert_number,
                )
                item['status'] = 'uploaded'
                item['certificate_id'] = str(cert.id)
                item['message'] = 'Sertifikat terupload.'
                ok_count += 1
            except Exception as exc:
                item['status'] = 'failed'
                item['message'] = str(exc)
                fail_count += 1

            results.append(item)

        return Response({
            'dry_run': dry_run,
            'total': len(files),
            'ok': ok_count,
            'failed': fail_count,
            'results': results,
        })

    @action(detail=True, methods=['post'], url_path='replace-file',
            parser_classes=[MultiPartParser, FormParser])
    def replace_file(self, request, event_id=None, pk=None):
        """Replace PDF sertifikat yang sudah ada (tanpa mengubah nomor)."""
        cert = self.get_object()
        pdf_file = request.FILES.get('pdf_file')
        if not pdf_file:
            return Response({'detail': 'pdf_file wajib diisi.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not pdf_file.name.lower().endswith('.pdf'):
            return Response({'detail': 'File harus berformat PDF.'},
                            status=status.HTTP_400_BAD_REQUEST)
        safe_name = f'{cert.certificate_number.replace("/", "_")}.pdf'
        cert.pdf_file.save(safe_name, pdf_file, save=True)
        cert.source = Certificate.Source.UPLOADED
        cert.save(update_fields=['source', 'updated_at'])
        return Response(CertificateSerializer(cert, context={'request': request}).data)


# ---------------------- PUBLIC ENDPOINTS ----------------------

class PublicCheckCertificateView(APIView):
    """Cek sertifikat berdasarkan NIK. Opsional filter event."""
    permission_classes = [AllowAny]

    def get(self, request):
        nik = (request.GET.get('nik') or request.GET.get('identity_number') or '').strip()
        event_id = request.GET.get('event_id')

        if not nik:
            return Response(
                {'detail': 'nik wajib diisi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cari semua sertifikat lintas event untuk peserta dengan NIK yang sama.
        qs = (
            Certificate.objects
            .filter(
                Q(participant__nik=nik) | Q(participant__nip=nik),
                status=Certificate.Status.AVAILABLE,
            )
            .exclude(pdf_file='')
            .exclude(pdf_file__isnull=True)
            .select_related('event', 'participant')
            .order_by('-event__start_date', '-generated_at')
        )

        if event_id:
            qs = qs.filter(event_id=event_id)

        if not qs.exists():
            return Response({
                'found': False,
                'message': 'Sertifikat Anda belum tersedia atau data Anda belum terdaftar.',
            })

        serializer = CertificatePublicSerializer(qs, many=True)
        return Response({'found': True, 'count': qs.count(), 'results': serializer.data})


class PublicDownloadCertificateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        cert = get_object_or_404(
            Certificate,
            download_token=token,
            status=Certificate.Status.AVAILABLE,
        )
        if not cert.pdf_file:
            raise Http404('File sertifikat tidak ditemukan.')
        return FileResponse(
            cert.pdf_file.open('rb'),
            as_attachment=True,
            filename=f'{cert.certificate_number.replace("/", "_")}.pdf',
            content_type='application/pdf',
        )


class PublicVerifyCertificateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        cert = Certificate.objects.select_related('event', 'participant').filter(
            verification_token=token
        ).first()
        if not cert:
            return Response({
                'valid': False,
                'message': 'Sertifikat tidak ditemukan.',
            })
        return Response({
            'valid': cert.status == Certificate.Status.AVAILABLE,
            'certificate_number': cert.certificate_number,
            'participant_name': cert.participant.full_name,
            'event_title': cert.event.title,
            'event_start': cert.event.start_date,
            'event_end': cert.event.end_date,
            'organizer': cert.event.organizer,
            'status': cert.status,
        })
