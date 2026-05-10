"""Utilities untuk generate QR Code & sertifikat PDF."""
import io
import os
from datetime import datetime

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROMAN_MONTHS = [
    '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
]


def _clean_event_title(title: str) -> str:
    clean = (title or 'EVENT').upper().replace(' ', '-')
    return clean[:30].strip('-')


def render_number_format(pattern: str, *, sequence: int, event_title: str,
                         when: datetime, app_name: str = 'SILAKHADIR') -> str:
    """Render pattern nomor sertifikat dari CertificateNumberFormat."""
    context = {
        'seq': sequence,
        'seq3': f'{sequence:03d}',
        'seq4': f'{sequence:04d}',
        'app': app_name,
        'event': _clean_event_title(event_title),
        'year': when.year,
        'month': f'{when.month:02d}',
        'month_roman': ROMAN_MONTHS[when.month],
        'day': f'{when.day:02d}',
    }
    try:
        return pattern.format(**context)
    except (KeyError, IndexError) as exc:
        raise ValueError(f'Placeholder tidak dikenal dalam pattern: {exc}')


def make_certificate_number(sequence: int, event_title: str, when: datetime) -> str:
    """
    Format default (backward-compatible):
    001/SIAKADIR/NAMA-KEGIATAN/BULAN(Romawi)/TAHUN
    """
    return render_number_format(
        '{seq3}/SIAKADIR/{event}/{month_roman}/{year}',
        sequence=sequence, event_title=event_title, when=when,
    )


def generate_qr_image(data: str, logo_path: str | None = None,
                      box_size: int = 10, border: int = 2) -> ContentFile:
    """Generate QR code PNG in-memory, opsional dengan logo di tengah.

    Error correction level H digunakan agar QR tetap terbaca walau bagian
    tengahnya tertutup logo.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white').convert('RGBA')

    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert('RGBA')
            # Logo sekitar 22% dari lebar QR
            qr_w, qr_h = img.size
            logo_size = int(qr_w * 0.22)
            # Resize dengan mempertahankan aspek
            logo.thumbnail((logo_size, logo_size), Image.LANCZOS)

            # Paste logo langsung ke QR tanpa background putih.
            # Karena QR memakai error correction level H, sampai ~30% area
            # dapat tertutup dan QR tetap terbaca.
            pos = ((qr_w - logo.size[0]) // 2, (qr_h - logo.size[1]) // 2)
            img.paste(logo, pos, mask=logo)
        except Exception:
            # Jika logo gagal dimuat, pakai QR polos saja
            pass

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return ContentFile(buf.getvalue(), name='qr.png')


def get_institution_logo_path() -> str | None:
    """Ambil path logo instansi dari AppSetting. Return None jika tidak ada."""
    try:
        from apps.settings_app.models import AppSetting
        setting = AppSetting.get_instance()
        if setting.institution_logo and setting.institution_logo.name:
            path = setting.institution_logo.path
            if os.path.exists(path):
                return path
    except Exception:
        pass
    return None


def _pct_to_xy(page_w, page_h, pct_x, pct_y):
    """Convert percent position (0-100) ke koordinat reportlab.
    Reportlab origin = bottom-left. Input pct_y dihitung dari atas.
    """
    x = page_w * (pct_x / 100.0)
    y = page_h * (1 - pct_y / 100.0)
    return x, y


def _format_date_range(start, end) -> str:
    if not start:
        return ''
    if not end or start.date() == end.date():
        return start.strftime('%d %B %Y')
    return f'{start.strftime("%d %B %Y")} s.d. {end.strftime("%d %B %Y")}'


def generate_certificate_pdf(certificate) -> ContentFile:
    """Generate PDF sertifikat untuk objek Certificate.

    Jika template tersedia, gunakan koordinat dan background dari template.
    Jika tidak, gunakan layout default (A4 landscape, warna biru pemerintahan).
    """
    event = certificate.event
    participant = certificate.participant
    template = event.certificate_template

    page_size = landscape(A4)
    page_w, page_h = page_size

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=page_size)

    # Background
    if template and template.background_image:
        try:
            bg = ImageReader(template.background_image.path)
            c.drawImage(bg, 0, 0, width=page_w, height=page_h, preserveAspectRatio=False)
        except Exception:
            _draw_default_background(c, page_w, page_h, event)
    else:
        _draw_default_background(c, page_w, page_h, event)

    # Helper untuk ambil posisi
    def pos(px, py):
        return _pct_to_xy(page_w, page_h, px, py)

    # Nomor sertifikat
    num_x, num_y = pos(
        template.number_position_x if template else 50,
        template.number_position_y if template else 30,
    )
    c.setFont('Helvetica', template.number_font_size if template else 14)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawCentredString(num_x, num_y, f'Nomor: {certificate.certificate_number}')

    # Nama peserta
    name_x, name_y = pos(
        template.name_position_x if template else 50,
        template.name_position_y if template else 45,
    )
    c.setFont('Helvetica-Bold', template.name_font_size if template else 36)
    c.setFillColorRGB(0.07, 0.18, 0.45)
    c.drawCentredString(name_x, name_y, participant.full_name.upper())

    # Nama kegiatan
    ev_x, ev_y = pos(
        template.event_position_x if template else 50,
        template.event_position_y if template else 58,
    )
    c.setFont('Helvetica', template.event_font_size if template else 20)
    c.setFillColorRGB(0.15, 0.15, 0.15)
    c.drawCentredString(ev_x, ev_y, event.title)
    if event.theme:
        c.setFont('Helvetica-Oblique', (template.event_font_size if template else 16) - 4)
        c.drawCentredString(ev_x, ev_y - 22, event.theme)

    # Tanggal
    d_x, d_y = pos(
        template.date_position_x if template else 50,
        template.date_position_y if template else 70,
    )
    c.setFont('Helvetica', template.date_font_size if template else 16)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawCentredString(d_x, d_y, _format_date_range(event.start_date, event.end_date))
    if event.location:
        c.setFont('Helvetica', (template.date_font_size if template else 14) - 2)
        c.drawCentredString(d_x, d_y - 20, event.location)

    # QR Code
    if certificate.qr_code:
        try:
            qr_img = ImageReader(certificate.qr_code.path)
            qr_x, qr_y = pos(
                template.qr_position_x if template else 10,
                template.qr_position_y if template else 85,
            )
            qr_size = 90
            c.drawImage(qr_img, qr_x - qr_size / 2, qr_y - qr_size / 2,
                        width=qr_size, height=qr_size, mask='auto')
        except Exception:
            pass

    # Tanda tangan & stempel
    if template:
        sig_y = page_h * 0.12
        if template.stamp_image:
            try:
                img = ImageReader(template.stamp_image.path)
                c.drawImage(img, page_w * 0.72, sig_y - 10, width=80, height=80,
                            mask='auto', preserveAspectRatio=True)
            except Exception:
                pass
        if template.signature_image:
            try:
                img = ImageReader(template.signature_image.path)
                c.drawImage(img, page_w * 0.75, sig_y, width=120, height=60,
                            mask='auto', preserveAspectRatio=True)
            except Exception:
                pass
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.setFont('Helvetica', 12)
        c.drawCentredString(page_w * 0.82, sig_y - 20, template.signer_position or '')
        c.setFont('Helvetica-Bold', 13)
        c.drawCentredString(page_w * 0.82, sig_y - 38, template.signer_name or '')

    c.showPage()
    c.save()

    filename = f'{certificate.certificate_number.replace("/", "_")}.pdf'
    return ContentFile(buf.getvalue(), name=filename)


def _draw_default_background(c, w, h, event):
    """Gambar background default jika tidak ada template."""
    # Border biru tua
    c.setStrokeColorRGB(0.07, 0.18, 0.45)
    c.setLineWidth(6)
    c.rect(15, 15, w - 30, h - 30)
    c.setLineWidth(2)
    c.setStrokeColorRGB(0.82, 0.68, 0.21)  # emas
    c.rect(28, 28, w - 56, h - 56)

    # Judul
    c.setFillColorRGB(0.07, 0.18, 0.45)
    c.setFont('Helvetica-Bold', 32)
    c.drawCentredString(w / 2, h - 85, 'SERTIFIKAT')
    c.setFont('Helvetica', 16)
    c.drawCentredString(w / 2, h - 108, 'Diberikan kepada:')
    # Organizer kecil
    if event.organizer:
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.setFont('Helvetica-Oblique', 10)
        c.drawCentredString(w / 2, 45, f'Penyelenggara: {event.organizer}')
