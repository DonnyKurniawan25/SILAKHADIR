"""Default filesystem storage that optimizes bytes before any filesystem write."""
from pathlib import PurePosixPath

from django.conf import settings
from django.core.files.base import ContentFile, File
from django.core.files.storage import FileSystemStorage

from .optimization import IMAGE_FORMATS, TARGET_BYTES, optimize_bytes


class _PreservingFile(File):
    """Do not move TemporaryUploadedFile, close it, or change its cursor."""
    def chunks(self, chunk_size=None):
        position = self.file.tell()
        try:
            self.file.seek(0)
            while True:
                chunk = self.file.read(chunk_size or self.DEFAULT_CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        finally:
            self.file.seek(position)


class OptimizedMediaStorage(FileSystemStorage):
    """Optimization applies to every FileField using this storage, not model signals.

    Filesystem collision handling and naming remain Django's. No original upload
    is ever saved to MEDIA_ROOT as an intermediate file. Caller files stay open
    and keep their original content/cursor, including disk-backed uploads.
    """
    def _save(self, name, content):
        extension = PurePosixPath(name).suffix.lower()
        replacement = None
        if extension in IMAGE_FORMATS or extension == '.pdf':
            limit = getattr(settings, 'MEDIA_OPTIMIZATION_MAX_INPUT_BYTES', 32_000_000)
            if getattr(content, 'size', limit + 1) <= limit:
                position = content.tell()
                try:
                    content.seek(0)
                    data = content.read(limit + 1)
                finally:
                    content.seek(position)
                if len(data) <= limit:
                    replacement = optimize_bytes(
                        name, data,
                        target_bytes=min(TARGET_BYTES, max(1, getattr(settings, 'MEDIA_OPTIMIZATION_TARGET_BYTES', TARGET_BYTES))),
                        max_pixels=getattr(settings, 'MEDIA_OPTIMIZATION_MAX_PIXELS', 16_777_216),
                        max_dimension=getattr(settings, 'MEDIA_OPTIMIZATION_MAX_DIMENSION', 12_000),
                        resize_steps=getattr(settings, 'MEDIA_OPTIMIZATION_RESIZE_STEPS', 12),
                        max_pdf_pages=getattr(settings, 'MEDIA_OPTIMIZATION_MAX_PDF_PAGES', 500),
                    )
        prepared = ContentFile(replacement, name=name) if replacement is not None else _PreservingFile(content, name=name)
        # FileSystemStorage receives only the final representation, never source
        # temporary_file_path(): its move fast-path would consume caller uploads.
        return super()._save(name, prepared)
