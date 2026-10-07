"""Conservative, bounded media optimization. Unsupported/unsafe inputs are unchanged."""
from io import BytesIO
from pathlib import PurePosixPath
import logging
import re
import warnings

from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)
TARGET_BYTES = 1_000_000
IMAGE_FORMATS = {'.jpg': 'JPEG', '.jpeg': 'JPEG', '.png': 'PNG', '.webp': 'WEBP'}


def optimize_bytes(name, data, *, target_bytes=TARGET_BYTES, max_pixels=16_777_216,
                   max_dimension=12_000, resize_steps=12, max_pdf_pages=500):
    """Return original bytes unless a validated, smaller representation is available.

    Image encoding never crosses formats. PNG remains lossless at each resolution;
    JPEG/WebP try quality 90..60 before bounded resizing. Limits are safety escape
    hatches, not promises that every arbitrary input can fit the target.
    """
    if len(data) < target_bytes:
        return data
    extension = PurePosixPath(name).suffix.lower()
    try:
        if extension in IMAGE_FORMATS:
            return _image(data, IMAGE_FORMATS[extension], target_bytes,
                          max_pixels, max_dimension, resize_steps)
        if extension == '.pdf':
            return _pdf(data, max_pdf_pages, target_bytes)
    except Exception:
        # A storage layer must not disguise corrupt/unsupported content as valid.
        logger.warning('Media optimization skipped: unsafe or unsupported content (%s)', extension)
    return data


def _image(data, expected_format, target, max_pixels, max_dimension, steps):
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(BytesIO(data)) as source:
            if (source.format != expected_format or getattr(source, 'n_frames', 1) != 1
                    or source.width * source.height > max_pixels
                    or max(source.size) > max_dimension):
                return data
            source.verify()
        with Image.open(BytesIO(data)) as source:
            source.load()
            image = ImageOps.exif_transpose(source)
            # Palette transparency must become an alpha channel, never flattened.
            alpha = 'A' in image.getbands() or 'transparency' in image.info
            image = image.convert('RGBA' if alpha and expected_format != 'JPEG' else 'RGB')
            best = data
            for _ in range(max(1, min(steps, 16))):
                qualities = (90, 80, 70, 60) if expected_format != 'PNG' else (None,)
                for quality in qualities:
                    output = BytesIO()
                    kwargs = {'compress_level': 9} if expected_format == 'PNG' else {'quality': quality}
                    if expected_format == 'JPEG':
                        kwargs.update(optimize=True, progressive=True)
                    if expected_format == 'WEBP':
                        kwargs['method'] = 4
                    image.save(output, format=expected_format, **kwargs)
                    candidate = output.getvalue()
                    if len(candidate) < len(best):
                        best = candidate
                    if len(candidate) < target:
                        return candidate
                width, height = image.size
                if max(width, height) <= 128:
                    break
                image = image.resize((max(1, int(width * .78)), max(1, int(height * .78))), Image.Resampling.LANCZOS)
            return best


def _has_signature(reader):
    root = reader.trailer['/Root']
    if '/Perms' in root:
        return True
    form = root.get('/AcroForm')
    if not form:
        return False
    form = form.get_object()
    if form.get('/SigFlags', 0):
        return True
    stack = list(form.get('/Fields', []))
    seen = set()
    while stack:
        field = stack.pop().get_object()
        marker = id(field)
        if marker in seen:
            continue
        seen.add(marker)
        if field.get('/FT') == '/Sig' or '/ByteRange' in field:
            return True
        value = field.get('/V')
        if value and hasattr(value.get_object(), 'get'):
            value = value.get_object()
            if value.get('/Type') == '/Sig' or '/ByteRange' in value:
                return True
        stack.extend(field.get('/Kids', []))
    return False


def _page_contract(page):
    contents = page.get_contents()
    return (contents.get_data() if contents is not None else b'',
            tuple(page.mediabox), tuple(page.cropbox), tuple(page.trimbox),
            tuple(page.bleedbox), tuple(page.artbox), page.get('/Rotate', 0),
            page.get('/UserUnit', 1), page.extract_text())


def _bounded_pdf_contents(reader, budget=8_000_000):
    """Preflight content/fonts before pypdf expands or parses their streams.

    Only plain or single-Flate text/vector PDFs are optimized. Complex filters,
    form/image XObjects and larger decoded streams stay byte-exact instead.
    """
    import zlib
    from pypdf.generic import ArrayObject
    remaining = budget
    stream_count = 0
    for page in reader.pages:
        resources = page.get('/Resources')
        resources = resources.get_object() if resources else {}
        if resources.get('/XObject'):
            return False
        contents = page.get('/Contents')
        contents = contents.get_object() if contents is not None else None
        streams = list(contents) if isinstance(contents, ArrayObject) else ([contents] if contents is not None else [])
        fonts = resources.get('/Font')
        fonts = fonts.get_object() if fonts else {}
        if len(fonts) > 1000:
            return False
        for font in fonts.values():
            mapping = font.get_object().get('/ToUnicode')
            if mapping is not None:
                streams.append(mapping)
        for stream in streams:
            stream = stream.get_object()
            stream_count += 1
            if stream_count > 1000 or not hasattr(stream, '_data'):
                return False
            raw = stream._data
            filters = stream.get('/Filter')
            if isinstance(filters, ArrayObject):
                filters = filters[0] if len(filters) == 1 else 'unsupported'
            if filters:
                if filters != '/FlateDecode' or stream.get('/DecodeParms'):
                    return False
                decoder = zlib.decompressobj()
                decoded = decoder.decompress(raw, remaining + 1)
                if not decoder.eof:
                    return False
                size = len(decoded)
            else:
                size = len(raw)
            remaining -= size
            if remaining < 0:
                return False
    return True


def _pdf(data, max_pages, target):
    # Deliberately conservative: even a signature marker in a comment blocks edits.
    if re.search(rb'/ByteRange\b|/Type\s*/Sig\b|/FT\s*/Sig\b', data):
        return data
    reader = PdfReader(BytesIO(data), strict=True)
    if reader.is_encrypted or _has_signature(reader) or len(reader.pages) > max_pages:
        return data
    if not _bounded_pdf_contents(reader):
        return data
    contracts = [_page_contract(page) for page in reader.pages]
    writer = PdfWriter()
    # Clone the entire graph: annotations, fonts, resources, metadata and forms.
    writer.clone_document_from_reader(reader)
    for page in writer.pages:
        page.compress_content_streams()
    output = BytesIO()
    writer.write(output)
    candidate = output.getvalue()
    if len(candidate) >= len(data):
        return data
    verified = PdfReader(BytesIO(candidate), strict=True)
    if len(verified.pages) != len(contracts):
        return data
    if [_page_contract(page) for page in verified.pages] != contracts:
        return data
    return candidate
