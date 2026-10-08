"""
Ekstraksi & matching sertifikat PDF ke peserta.

Fungsi utama:
- extract_text_from_pdf(file) -> teks keseluruhan PDF
- extract_certificate_number(text) -> pola nomor sertifikat
- find_participant(text, participants) -> peserta yang cocok berdasarkan nama
"""
import re
import unicodedata
from io import BytesIO

from pypdf import PdfReader


# --- Ekstraksi teks ---------------------------------------------------------

def extract_text_from_pdf(file_obj) -> str:
    """Baca seluruh halaman PDF dan gabung menjadi satu string."""
    # Reset posisi pointer (untuk InMemoryUploadedFile)
    if hasattr(file_obj, 'seek'):
        try:
            file_obj.seek(0)
        except Exception:
            pass

    data = file_obj.read() if hasattr(file_obj, 'read') else file_obj
    if hasattr(file_obj, 'seek'):
        try:
            file_obj.seek(0)
        except Exception:
            pass

    reader = PdfReader(BytesIO(data))
    pages = []
    for page in reader.pages:
        try:
            text = page.extract_text(extraction_mode='layout') or page.extract_text() or ''
        except Exception:
            try:
                text = page.extract_text() or ''
            except Exception:
                text = ''
        pages.append(text)
    return '\n'.join(pages)


# --- Nomor sertifikat -------------------------------------------------------

def extract_certificate_number(text: str) -> str | None:
    """Suggest one unambiguous explicitly labelled number, never truncate/guess.

    Numeric and separated values are supported, including a label/value split
    across lines. Unlabelled values deliberately require manual review.
    """
    if not text:
        return None

    # Only explicit labels are evidence. Never guess from dates/NIP elsewhere.
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    label = re.compile(
        r'(?:^|[^\w])(?:nomor\b|no\b|n\s+o\s+m\s+o\s+r|n\s+o(?=[\s:.-]))\.?'
        r'(?:[ \t]+s\s*e\s*r\s*t\s*i\s*f\s*i\s*k\s*a\s*t)?'
        r'[ \t]*[:\-]?[ \t]*(.*)$',
        re.I
    )
    candidates = set()
    for i, line in enumerate(lines):
        match = label.search(line)
        if not match:
            continue
        raw = match.group(1).strip()
        j = i + 1
        if not raw and j < len(lines) and lines[j] in (':', '-', '.'):
            j += 1
        if not raw and j < len(lines):
            raw = lines[j]
        if not raw:
            return None
        if not re.fullmatch(r'[A-Za-z0-9_]+(?:[ \t]*(?:[/.-]|[A-Za-z0-9_])[ \t]*)*', raw):
            return None
        if any(w.lower() in ('atau', 'and', 'or', 'dan') for w in raw.split()):
            return None
        number = _cleanup_number(raw)
        if not _looks_like_number(number):
            return None
        candidates.add(number)
    return next(iter(candidates)) if len(candidates) == 1 else None


def _cleanup_number(raw: str) -> str:
    return re.sub(r'\s+', '', raw).strip('/-.')


def _looks_like_number(candidate: str) -> bool:
    """Filter false-positive: hindari nama orang dst."""
    if not candidate or len(candidate) > 100 or not any(ch.isdigit() for ch in candidate):
        return False
    # Identity numbers and calendar dates are not safe certificate suggestions.
    if re.fullmatch(r'\d{16,18}', candidate):
        return False
    if re.fullmatch(r'(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})', candidate):
        return False
    return True


# --- Matching nama peserta --------------------------------------------------

def _normalize(text: str) -> str:
    if not text:
        return ''
    # Hilangkan gelar & tanda baca, lowercase
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _name_tokens(name: str) -> set[str]:
    norm = _normalize(name)
    # Buang gelar umum
    stop = {
        'bpk', 'ibu', 'bp', 'bpk.', 'sdr', 'sdri',
        's', 'si', 'st', 'sh', 'se', 'mm', 'mt', 'msi', 'msc',
        'mpd', 'spd', 'skom', 'mkom', 'phd', 'drs', 'dra', 'dr',
    }
    tokens = [t for t in norm.split() if t not in stop and len(t) > 1]
    return set(tokens)


def find_participant(text: str, participants) -> tuple[object | None, float]:
    """
    Cari peserta yang paling cocok dengan teks PDF.

    Return (participant | None, score 0..1).
    Strategi: token overlap. Pilih peserta dengan overlap terbanyak.
    Threshold minimum: 50% token nama peserta harus ada di PDF, dan minimal 2 token.
    """
    if not participants:
        return None, 0.0

    normalized_text = _normalize(text)
    text_words = set(normalized_text.split())
    # Juga tambahkan substring full (untuk nama yg dieja bersambung)
    joined_text = ' ' + normalized_text + ' '

    best, best_score = None, 0.0
    for p in participants:
        p_tokens = _name_tokens(p.full_name)
        if not p_tokens:
            continue

        # 1) cek full-name substring
        full_name_norm = _normalize(p.full_name)
        if full_name_norm and f' {full_name_norm} ' in joined_text:
            return p, 1.0

        # 2) token overlap
        overlap = p_tokens & text_words
        if not overlap:
            continue

        score = len(overlap) / max(len(p_tokens), 1)
        # Butuh minimal 2 token cocok (untuk mengurangi false match)
        if len(overlap) < 2 and len(p_tokens) > 1:
            continue

        if score > best_score:
            best_score = score
            best = p

    # Threshold final
    if best and best_score >= 0.5:
        return best, best_score
    return None, best_score


# --- Identity number matching (bonus) ---------------------------------------

IDENTITY_PATTERN = re.compile(r'\b(\d{16,20})\b')


def extract_identity_numbers(text: str) -> list[str]:
    """Ambil semua NIK/NIP 16-20 digit dari teks PDF."""
    if not text:
        return []
    return list(dict.fromkeys(IDENTITY_PATTERN.findall(text)))
