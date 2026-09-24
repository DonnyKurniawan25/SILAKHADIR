import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.certificates.services import generate_certificates_for_event
from apps.certificates.utils import (
    generate_qr_image,
    get_institution_logo_path,
)
from apps.events.models import Event
from apps.events.serializers import EventPublicSerializer
from apps.participants.models import Participant

from .models import Attendance
from .serializers import PublicAttendanceSerializer

logger = logging.getLogger(__name__)


def _client_ip(request):
    x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_fwd:
        return x_fwd.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class PublicEventInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        event = get_object_or_404(Event, public_slug=slug)
        return Response(EventPublicSerializer(event).data)


class PublicEventQRView(APIView):
    """Serve PNG QR code absensi (publik)."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        from django.conf import settings
        event = get_object_or_404(Event, public_slug=slug)
        url = f'{settings.FRONTEND_URL}/absensi/{event.public_slug}'
        content = generate_qr_image(
            url,
            logo_path=get_institution_logo_path(),
            box_size=12, border=2,
        )
        resp = HttpResponse(content.read(), content_type='image/png')
        resp['Content-Disposition'] = f'inline; filename="qr-{event.public_slug}.png"'
        # Matikan cache agar QR selalu segar saat admin ganti logo
        resp['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp['Pragma'] = 'no-cache'
        resp['Expires'] = '0'
        return resp


class PublicParticipantLookupView(APIView):
    """Lookup profil peserta lama untuk mengisi form absensi otomatis.

    NIK digunakan sebagai identitas awal. Untuk profil ASN, NIP juga wajib cocok
    sebelum data profil dikembalikan.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'attendance'

    def post(self, request, slug):
        event = get_object_or_404(Event, public_slug=slug)
        nik = str(request.data.get('nik') or '').strip()
        nip = str(request.data.get('nip') or '').strip()
        if len(nik) != 16 or not nik.isdigit():
            return Response({'detail': 'NIK harus 16 digit angka.'}, status=status.HTTP_400_BAD_REQUEST)
        if nip and (len(nip) != 18 or not nip.isdigit()):
            return Response({'detail': 'NIP harus 18 digit angka.'}, status=status.HTTP_400_BAD_REQUEST)

        participant = Participant.objects.filter(nik=nik).order_by('-updated_at').first()
        if not participant:
            return Response({'found': False})
        if participant.is_asn and participant.nip != nip:
            return Response({'found': False, 'requires_nip': True})

        return Response({
            'found': True,
            'is_asn': participant.is_asn,
            'full_name': participant.full_name,
            'institution': participant.institution,
            'position': participant.position,
            'phone': participant.phone,
            'email': participant.email,
        })


class PublicAttendanceView(APIView):
    """Endpoint publik untuk submit absensi tanpa login."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'attendance'

    def post(self, request, slug):
        event = get_object_or_404(Event, public_slug=slug)

        if not event.is_accepting_attendance():
            return Response(
                {'detail': 'Absensi untuk kegiatan ini sedang tidak dibuka.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublicAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        nik = data['nik']

        # Cek awal: peserta dengan NIK ini sudah pernah absen?
        already = Attendance.objects.filter(
            event=event,
            participant__nik=nik,
        ).select_related('participant').first()
        if already:
            return Response({
                'detail': (
                    f'NIK {nik} sudah tercatat hadir pada kegiatan ini '
                    f'atas nama {already.participant.full_name} pada '
                    f'{already.attendance_time.strftime("%d %b %Y %H:%M")}.'
                ),
                'code': 'already_attended',
            }, status=status.HTTP_409_CONFLICT)

        try:
            with transaction.atomic():
                participant, created = Participant.objects.get_or_create(
                    event=event,
                    nik=nik,
                    defaults={
                        'nip': data.get('nip', ''),
                        'is_asn': data.get('is_asn', False),
                        'full_name': data['full_name'],
                        'institution': data.get('institution', ''),
                        'position': data.get('position', ''),
                        'phone': data.get('phone', ''),
                        'email': data.get('email', ''),
                    },
                )

                if not created:
                    # Update data yang masih kosong saja
                    update_fields = []
                    for fname in ('full_name', 'institution', 'position', 'phone', 'email',
                                  'nip', 'is_asn'):
                        new = data.get(fname)
                        if new is not None and new != '' and not getattr(participant, fname):
                            setattr(participant, fname, new)
                            update_fields.append(fname)
                    if update_fields:
                        participant.save(update_fields=update_fields)

                attendance = Attendance.objects.create(
                    event=event,
                    participant=participant,
                    ip_address=_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                    signature=data.get('signature'),
                    photo=data.get('photo'),
                    status=Attendance.Status.HADIR,
                )
        except IntegrityError:
            # Race condition: request paralel dengan NIK sama, unique constraint trip
            return Response({
                'detail': f'NIK {nik} sudah tercatat hadir pada kegiatan ini.',
                'code': 'already_attended',
            }, status=status.HTTP_409_CONFLICT)

        # Buat draft preview setelah attendance; nomor/background/signature tetap
        # dikendalikan admin melalui workflow certificates.
        try:
            generate_certificates_for_event(event, regenerate=False)
        except Exception:
            logger.exception('Gagal membuat sertifikat awal untuk event %s', event.id)

        return Response({
            'detail': 'Absensi berhasil direkam.',
            'attendance_id': str(attendance.id),
            'event_title': event.title,
            'participant_name': participant.full_name,
        }, status=status.HTTP_201_CREATED)
