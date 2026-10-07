"""Read-only public PDF eligibility; never generate a replacement document."""

from .models import Certificate


def open_public_pdf(certificate):
    """Return an open existing PDF, positioned at its start, or None."""
    if certificate.status not in (Certificate.Status.AVAILABLE, Certificate.Status.PROCESSING):
        return None
    field = certificate.pdf_file
    if not field:
        return None
    stream = None
    try:
        stream = field.storage.open(field.name, 'rb')
        if stream.read(5) != b'%PDF-':
            stream.close()
            return None
        stream.seek(0)
        return stream
    except (OSError, ValueError, NotImplementedError):
        if stream is not None:
            stream.close()
        return None


def can_download_public_pdf(certificate):
    stream = open_public_pdf(certificate)
    if stream is None:
        return False
    stream.close()
    return True
