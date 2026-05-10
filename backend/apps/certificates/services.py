"""Service layer untuk generate & upload sertifikat."""
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.attendance.models import Attendance
from apps.settings_app.models import AppSetting

from .models import Certificate, CertificateNumberFormat
from .utils import (
    generate_certificate_pdf,
    generate_qr_image,
    get_institution_logo_path,
    make_certificate_number,
    render_number_format,
)


def _app_name() -> str:
    try:
        return AppSetting.get_instance().app_name or 'SILAKHADIR'
    except Exception:
        return 'SILAKHADIR'


def _next_sequence(event, number_format: CertificateNumberFormat | None) -> int:
    """
    Hitung urutan nomor sertifikat berikutnya.
    - Jika format pakai global counter: gunakan last_sequence + 1.
    - Jika per-event: hitung jumlah certificate di event + 1.
    """
    if number_format and number_format.use_global_counter:
        return number_format.last_sequence + 1
    return Certificate.objects.filter(event=event).count() + 1


def preview_certificate_number(event, number_format: CertificateNumberFormat,
                               sequence: int | None = None) -> str:
    """Preview hasil pattern tanpa menyimpan data."""
    if sequence is None:
        sequence = _next_sequence(event, number_format)
    return render_number_format(
        number_format.pattern,
        sequence=sequence,
        event_title=event.title,
        when=timezone.now(),
        app_name=_app_name(),
    )


@transaction.atomic
def create_or_update_certificate(*, event, participant, pdf_file,
                                 custom_number, generate_qr=True):
    """
    Buat / update sertifikat untuk satu peserta.

    - `custom_number` (wajib): nomor sertifikat dari admin.
    - `pdf_file` (wajib): file PDF yang sudah ditandatangani.

    Jika peserta sudah punya sertifikat, file & nomor di-update (replace).
    """
    existing = Certificate.objects.filter(
        event=event, participant=participant
    ).first()

    cert = existing or Certificate(event=event, participant=participant)
    cert.certificate_number = custom_number.strip()
    cert.source = Certificate.Source.UPLOADED
    cert.status = Certificate.Status.AVAILABLE
    cert.save()

    # QR code -> arahkan ke halaman verifikasi publik
    if generate_qr and not cert.qr_code:
        verify_url = f'{settings.FRONTEND_URL}/verifikasi/{cert.verification_token}'
        qr_file = generate_qr_image(verify_url, logo_path=get_institution_logo_path())
        cert.qr_code.save(f'{cert.id}.png', qr_file, save=False)

    safe_name = f'{cert.certificate_number.replace("/", "_").replace(" ", "_")}.pdf'
    cert.pdf_file.save(safe_name, pdf_file, save=False)

    cert.save()
    return cert


@transaction.atomic
def generate_certificates_for_event(event, regenerate: bool = False,
                                    number_format: CertificateNumberFormat | None = None):
    """
    Generate sertifikat untuk semua peserta hadir (PDF auto dari template).
    """
    attended = (
        Attendance.objects.filter(event=event, status=Attendance.Status.HADIR)
        .select_related('participant')
    )

    generated, skipped = [], []
    now = timezone.now()
    seq_counter = _next_sequence(event, number_format) - 1

    for att in attended:
        existing = Certificate.objects.filter(
            event=event, participant=att.participant
        ).first()
        if existing and not regenerate:
            skipped.append(existing)
            continue

        if existing and regenerate:
            cert = existing
        else:
            seq_counter += 1
            if number_format:
                cert_number = render_number_format(
                    number_format.pattern,
                    sequence=seq_counter,
                    event_title=event.title,
                    when=now,
                    app_name=_app_name(),
                )
            else:
                cert_number = make_certificate_number(seq_counter, event.title, now)
            cert = Certificate.objects.create(
                event=event,
                participant=att.participant,
                certificate_number=cert_number,
                number_format=number_format,
                source=Certificate.Source.GENERATED,
            )

        verify_url = f'{settings.FRONTEND_URL}/verifikasi/{cert.verification_token}'
        qr_file = generate_qr_image(verify_url, logo_path=get_institution_logo_path())
        cert.qr_code.save(f'{cert.id}.png', qr_file, save=False)

        pdf_file = generate_certificate_pdf(cert)
        cert.pdf_file.save(pdf_file.name, pdf_file, save=False)

        cert.status = Certificate.Status.AVAILABLE
        cert.save()
        generated.append(cert)

    if number_format and number_format.use_global_counter:
        number_format.last_sequence = seq_counter
        number_format.save(update_fields=['last_sequence', 'updated_at'])

    return generated, skipped
