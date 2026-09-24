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


def validate_uploaded_image(upload, *, max_size=10 * 1024 * 1024):
    if not upload:
        return
    if upload.size > max_size:
        raise ValueError('Ukuran gambar maksimal 10MB.')
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            img.verify()
        upload.seek(0)
    except Exception as exc:
        raise ValueError('File harus berupa gambar yang valid.') from exc


CERTIFICATE_LAYOUT_FIELDS = (
    'name_position_x', 'name_position_y', 'event_position_x', 'event_position_y',
    'date_position_x', 'date_position_y', 'qr_position_x', 'qr_position_y',
    'number_position_x', 'number_position_y', 'signature_position_x',
    'signature_position_y', 'signature_width', 'signature_height',
    'name_font_size', 'event_font_size', 'date_font_size', 'number_font_size',
)


def certificate_layout(template):
    """Return every numeric layout field as JSON-safe numeric values."""
    return {field: getattr(template, field) for field in CERTIFICATE_LAYOUT_FIELDS}


def suggest_certificate_layout(image_file):
    """Suggest a certificate layout from image ink/whitespace, without AI/network calls.

    The image is reduced to row/column ink density. Large whitespace bands are
    preferred for text, while the lower-right whitespace is preferred for a
    signature. This deliberately remains a transparent heuristic.
    """
    image_file.seek(0)
    with Image.open(image_file) as source:
        image = source.convert('L')
        width, height = image.size
        if width < 20 or height < 20:
            raise ValueError('Gambar terlalu kecil untuk dianalisis.')
        # Keep analysis bounded for large uploads while retaining proportions.
        image.thumbnail((400, 400), Image.Resampling.LANCZOS)
        width, height = image.size
        pixels = image.load()
        row_density = [sum(pixels[x, y] < 220 for x in range(width)) / width for y in range(height)]
        col_density = [sum(pixels[x, y] < 220 for y in range(height)) / height for x in range(width)]

        def whitespace_center(start, end):
            start, end = max(0, start), min(height, end)
            if start >= end:
                return (start + end) / 2
            return min(range(start, end), key=lambda y: row_density[y])

        # Text normally belongs in the broad middle of a landscape certificate.
        name_y = whitespace_center(int(height * .34), int(height * .62))
        number_y = whitespace_center(int(height * .14), int(height * .38))
        # Use the clearest lower-right area for the signature anchor.
        right_start = int(width * .62)
        bottom_start = int(height * .65)
        signature_x = min(range(right_start, width), key=lambda x: col_density[x])
        signature_y = min(range(bottom_start, height), key=lambda y: row_density[y])
        center_x = min(range(width), key=lambda x: col_density[x])

        ink_ratio = sum(row_density) / height
        confidence = round(max(.25, min(.95, .55 + min(ink_ratio, .45))), 2)
        return {
            'name_position_x': round(center_x / width * 100, 2),
            'name_position_y': round(name_y / height * 100, 2),
            'event_position_x': round(center_x / width * 100, 2),
            'event_position_y': round(min(99, name_y / height * 100 + 13), 2),
            'date_position_x': round(center_x / width * 100, 2),
            'date_position_y': round(min(99, name_y / height * 100 + 25), 2),
            'qr_position_x': 10.0, 'qr_position_y': 85.0,
            'number_position_x': round(center_x / width * 100, 2),
            'number_position_y': round(number_y / height * 100, 2),
            'signature_position_x': round(signature_x / width * 100, 2),
            'signature_position_y': round(signature_y / height * 100, 2),
            'signature_width': 14.0, 'signature_height': 8.0,
            'name_font_size': 36, 'event_font_size': 20,
            'date_font_size': 16, 'number_font_size': 14,
        }, confidence


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

    Hanya gunakan background template admin; tanpa template tidak ada PDF.
    """
    event = certificate.event
    participant = certificate.participant
    template = event.certificate_template
    if not template or not template.background_image:
        return None

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
            raise ValueError('Background template tidak dapat dibaca')
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
    number = certificate.certificate_number or 'Menunggu nomor dari admin'
    c.drawCentredString(num_x, num_y, f'Nomor: {number}')

    if certificate.status == certificate.Status.PROCESSING:
        c.saveState()
        c.setFillColorRGB(0.75, 0.1, 0.1, alpha=0.28)
        c.setFont('Helvetica-Bold', 42)
        c.translate(page_w / 2, page_h / 2)
        c.rotate(30)
        c.drawCentredString(0, 0, 'BELUM DITANDATANGANI')
        c.restoreState()

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

    # Tanda tangan & stempel. Prioritas: template kegiatan, lalu branding
    # global yang diunggah admin dari Pengaturan.
    if template:
        global_signature = None
        global_stamp = None
        try:
            from apps.settings_app.models import AppSetting
            branding = AppSetting.get_instance()
            global_signature = branding.signature_image.path if branding.signature_image else None
            global_stamp = branding.stamp_image.path if branding.stamp_image else None
        except Exception:
            pass

        signature_path = template.signature_image.path if template.signature_image else None
        sig_x, sig_y = pos(template.signature_position_x, template.signature_position_y)
        sig_w = page_w * (template.signature_width / 100)
        sig_h = page_h * (template.signature_height / 100)
        if signature_path:
            try:
                img = ImageReader(signature_path)
                c.drawImage(img, sig_x - sig_w / 2, sig_y - sig_h / 2,
                            width=sig_w, height=sig_h, mask='auto',
                            preserveAspectRatio=True, anchor='c')
            except Exception:
                pass
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.setFont('Helvetica', 12)
        c.drawCentredString(sig_x, sig_y - sig_h / 2 - 20, template.signer_position or '')
        c.setFont('Helvetica-Bold', 13)
        c.drawCentredString(sig_x, sig_y - sig_h / 2 - 38, template.signer_name or '')

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
