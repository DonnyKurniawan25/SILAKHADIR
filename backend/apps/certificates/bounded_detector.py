"""Read-only, conservative certificate suggestions; unsupported PDFs need review.

Budgets cover attempted files (including failures), raw reads and decoded streams.
Images are never decoded. All text-bearing streams are preflighted before extraction.
"""
import base64
import re
import time
import zlib
from io import BytesIO
from pypdf import PdfReader
from pypdf.generic import ArrayObject
from .matcher import extract_certificate_number

MAX_RAW_BYTES = 8 * 1024 * 1024
MAX_PAGES = 10
MAX_DECODED_BYTES = 2 * 1024 * 1024
MAX_TEXT_CHARS = 100_000
MAX_STREAMS = 128
MAX_FORM_DEPTH = 4


class UnsafePDF(ValueError):
    pass


class DetectionBudget:
    def __init__(self, max_files=50, max_raw=32 * 1024 * 1024,
                 max_decoded=8 * 1024 * 1024, max_seconds=5):
        self.files = max_files
        self.raw = max_raw
        self.decoded = max_decoded
        self.deadline = time.monotonic() + max_seconds
        self.stopped = False

    def available(self):
        if (self.stopped or self.files <= 0 or self.raw <= 0 or
                self.decoded <= 0 or time.monotonic() >= self.deadline):
            self.stopped = True
            return False
        return True


def _guard_cmap(data):
    """Bound compact glyph ranges before pypdf expands them into dictionaries."""
    if len(data) > 64 * 1024:
        raise UnsafePDF()
    data = re.sub(rb'%[^\r\n]*', b'', data)
    if any(len(token) > 32 for token in re.findall(rb'<([0-9a-fA-F]*)>', data)):
        raise UnsafePDF()
    blocks = list(re.finditer(rb'(\d+)\s+beginbf(char|range)\b(.*?)endbf\2\b', data, re.S))
    if len(blocks) != len(re.findall(rb'\bbeginbf(?:char|range)\b', data)):
        raise UnsafePDF()
    total = 0
    for block in blocks:
        body = block.group(3)
        pattern = (rb'<([0-9a-fA-F]{1,8})>\s*<([0-9a-fA-F]{1,32})>' if block.group(2) == b'char'
                   else rb'<([0-9a-fA-F]{1,8})>\s*<([0-9a-fA-F]{1,8})>\s*(?:<[0-9a-fA-F]{1,32}>|\[[^\]]*\])')
        matches = list(re.finditer(pattern, body))
        if len(matches) != int(block.group(1)):
            raise UnsafePDF()
        cursor = 0
        for match in matches:
            if body[cursor:match.start()].strip():
                raise UnsafePDF()
            cursor = match.end()
            low = int(match.group(1), 16)
            high = int(match.group(2), 16) if block.group(2) == b'range' else low
            if high < low or high > 65535:
                raise UnsafePDF()
            total += high - low + 1
            if total > 8192:
                raise UnsafePDF()
        if body[cursor:].strip():
            raise UnsafePDF()
    return total


def _preflight(reader, budget):
    remaining = min(MAX_DECODED_BYTES, budget.decoded)
    streams = {}
    cmaps = set()
    cmap_glyphs = 0
    active = set()
    forms = set()
    calls = 0
    invoked = set()

    def decode(value):
        nonlocal remaining, calls
        value = value.get_object()
        marker = id(value)
        if marker in streams:
            return streams[marker]
        streams[marker] = None
        if len(streams) > MAX_STREAMS or not hasattr(value, '_data'):
            raise UnsafePDF()
        raw = value._data
        filters = value.get('/Filter')
        filters = list(filters) if isinstance(filters, ArrayObject) else ([filters] if filters else [])
        if value.get('/DecodeParms'):
            raise UnsafePDF()
        # ReportLab/Canva commonly wrap Flate text in ASCII85.
        if filters and filters[0] == '/ASCII85Decode':
            raw = base64.a85decode(raw, adobe=raw.endswith(b'~>'))
            filters = filters[1:]
        if filters == ['/FlateDecode']:
            decoder = zlib.decompressobj()
            decoded = decoder.decompress(raw, remaining + 1)
            if not decoder.eof or decoder.unused_data:
                budget.decoded -= len(decoded)
                if budget.decoded <= 0:
                    budget.stopped = True
                raise UnsafePDF()
        elif not filters:
            decoded = raw
        else:
            raise UnsafePDF()
        size = len(decoded)
        budget.decoded -= size
        remaining -= size
        if remaining < 0:
            if budget.decoded <= 0:
                budget.stopped = True
            raise UnsafePDF()
        # Bound repeated Form invocation/operation and font-map parsing work.
        calls += len(re.findall(rb'\bDo\b', decoded))
        for name in re.findall(rb'(/[^\s<>\[\]()]+)\s+Do\b', decoded):
            name = re.sub(rb'#([0-9a-fA-F]{2})', lambda m: bytes([int(m[1], 16)]), name)
            if name in invoked:
                raise UnsafePDF()
            invoked.add(name)
        if calls > 100 or len(decoded.split()) > 50_000:
            raise UnsafePDF()
        streams[marker] = decoded
        return decoded

    def contents(value):
        if value is None:
            return
        value = value.get_object()
        for stream in value if isinstance(value, ArrayObject) else [value]:
            decode(stream)

    def resources(value, depth=0):
        nonlocal cmap_glyphs
        if not value:
            return
        value = value.get_object()
        fonts = value.get('/Font')
        fonts = fonts.get_object() if fonts else {}
        if len(fonts) > 64:
            raise UnsafePDF()
        for font in fonts.values():
            font = font.get_object()
            if font.get('/Subtype') == '/Type3':
                raise UnsafePDF()
            mapping = font.get('/ToUnicode')
            if mapping is not None:
                stream = mapping.get_object()
                decoded = decode(stream)
                marker = id(stream)
                if marker not in cmaps:
                    cmap_glyphs += _guard_cmap(decoded)
                    cmaps.add(marker)
                    if cmap_glyphs > 8192:
                        raise UnsafePDF()
        objects = value.get('/XObject')
        objects = objects.get_object() if objects else {}
        if len(objects) > 64:
            raise UnsafePDF()
        for obj in objects.values():
            obj = obj.get_object()
            if obj.get('/Subtype') == '/Image':
                continue  # extract_text does not decode image pixels.
            marker = id(obj)
            if obj.get('/Subtype') != '/Form' or marker in active or depth >= MAX_FORM_DEPTH:
                raise UnsafePDF()
            # Repeated resources can multiply extraction work: fail closed.
            if marker in forms:
                raise UnsafePDF()
            forms.add(marker)
            active.add(marker)
            decode(obj)
            resources(obj.get('/Resources'), depth + 1)
            active.remove(marker)

    for page in reader.pages:
        if time.monotonic() >= budget.deadline:
            budget.stopped = True
            raise UnsafePDF()
        contents(page.get('/Contents'))
        resources(page.get('/Resources'))


def _validate_pages(reader):
    """Check page-tree cycles/fanout before pypdf flattens it."""
    seen = set()
    leaves = 0

    def visit(node, depth=0):
        nonlocal leaves
        node = node.get_object()
        marker = id(node)
        if marker in seen or depth > 16 or len(seen) >= 32:
            raise UnsafePDF()
        seen.add(marker)
        if node.get('/Type') == '/Page':
            leaves += 1
            if leaves > MAX_PAGES:
                raise UnsafePDF()
            return
        if node.get('/Type') != '/Pages':
            raise UnsafePDF()
        kids = node.get('/Kids')
        kids = kids.get_object() if kids else []
        if len(kids) > MAX_PAGES:
            raise UnsafePDF()
        for kid in kids:
            visit(kid, depth + 1)
    visit(reader.trailer['/Root']['/Pages'])


def detect_number(source, budget):
    """Never close or modify caller's stream; no partial-document suggestions."""
    if not budget.available():
        return ''
    budget.files -= 1
    position = None
    try:
        position = source.tell()
        source.seek(0)
        data = source.read(min(MAX_RAW_BYTES, budget.raw) + 1)
        budget.raw -= len(data)
        if budget.raw <= 0:
            budget.stopped = True
        if len(data) > MAX_RAW_BYTES or budget.raw < 0:
            return ''
        # Object/xref streams decode during reader construction, before preflight.
        # Reject those and oversized/complex page trees before invoking pypdf.
        if (re.search(rb'/Type\s*/(?:ObjStm|XRef)\b', data) or
                len(re.findall(rb'\b\d+\s+\d+\s+obj\b', data)) > 2000 or
                len(re.findall(rb'/Type\s*/Page\b', data)) > MAX_PAGES or
                len(re.findall(rb'/Type\s*/Pages\b', data)) > 16 or
                any(int(n) > MAX_PAGES for n in re.findall(rb'/Count\s+(\d+)', data))):
            return ''
        if time.monotonic() >= budget.deadline:
            budget.stopped = True
            return ''
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            return ''
        _validate_pages(reader)
        if len(reader.pages) > MAX_PAGES:
            return ''
        _preflight(reader, budget)
        parts = []
        size = 0
        for page in reader.pages:
            if time.monotonic() >= budget.deadline:
                budget.stopped = True
                return ''
            try:
                text = page.extract_text(extraction_mode='layout') or page.extract_text() or ''
            except Exception:
                text = page.extract_text() or ''
            size += len(text)
            if size > MAX_TEXT_CHARS:
                return ''
            parts.append(text)
        return extract_certificate_number('\n'.join(parts)) or ''
    except Exception:
        return ''
    finally:
        if position is not None:
            try:
                source.seek(position)
            except Exception:
                pass
