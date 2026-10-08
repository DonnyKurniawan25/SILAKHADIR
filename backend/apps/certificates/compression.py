"""Explicit lossless recompression of final artifacts, never normal upload optimization."""
import fcntl
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from django.core.files import File
from django.core.files.storage import FileSystemStorage
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from apps.events.models import Event
from .models import Certificate, CertificateCompressionJob

logger = logging.getLogger(__name__)
COMPRESS_LOCK = '/tmp/silakhadir-certificate-compress.lock'
MAX_INPUT = 50 * 1024 * 1024
MAX_JOB = 10000
TARGET = 1000000
ACCEPT = 2000000
SIGNATURE_NAMES = {'/Sig', '/ByteRange', '/Perms', '/SigFlags'}
UNSAFE_NAMES = {'/JavaScript', '/JS', '/OpenAction', '/AA', '/Launch', '/RichMedia', '/EmbeddedFiles', '/XFA'}


class CompressorBusy(APIException):
    status_code = 409
    default_detail = 'Kompresor sedang digunakan. Silakan coba langkah ini lagi.'


@contextmanager
def compressor_lock():
    # Shared inode across all Gunicorn processes. Never unlink this lock file.
    fd = os.open(COMPRESS_LOCK, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'a+b') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise CompressorBusy()
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def valid_uuid(value, label):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError(f'{label} harus UUID yang valid.')


def payload(job):
    total = len(job.certificate_ids)
    return {'job_id': str(job.pk), 'total': total, 'processed': job.processed,
            'done': job.processed >= total, 'results': job.results}


def start_job(event_id, owner):
    event_id = valid_uuid(event_id, 'event_id')
    with transaction.atomic():
        event = get_object_or_404(Event.objects.select_for_update(), pk=event_id)
        ids = list(Certificate.objects.filter(event=event).order_by('pk').values_list('pk', flat=True)[:MAX_JOB + 1])
        if len(ids) > MAX_JOB:
            raise ValidationError(f'Maksimal {MAX_JOB} sertifikat per pekerjaan; kegiatan ini melebihi batas.')
        return payload(CertificateCompressionJob.objects.create(event=event, owner=owner, certificate_ids=[str(pk) for pk in ids]))


def final_storage():
    source = Certificate._meta.get_field('pdf_file').storage
    return FileSystemStorage(location=source.location, base_url=source.base_url,
                             file_permissions_mode=source.file_permissions_mode,
                             directory_permissions_mode=source.directory_permissions_mode)


def run_qpdf(mode, source, target, directory, deadline):
    stdout = Path(directory) / 'qpdf.stdout'
    stderr = Path(directory) / 'qpdf.stderr'
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ValueError('PDF processing deadline')
    with stdout.open('wb') as out, stderr.open('wb') as err:
        completed = subprocess.run([sys.executable, str(Path(__file__).with_name('compression_worker.py')),
                                    mode, str(source), str(target)], stdout=out, stderr=err,
                                   timeout=min(20, remaining), check=False)
    if completed.returncode != 0:
        raise ValueError('qpdf rejected document or resource limit')
    if mode == 'json':
        if stdout.stat().st_size > 16 * 1024 * 1024:
            raise ValueError('qpdf JSON limit')
        with stdout.open('rb') as stream:
            return json.load(stream)


def decoded_name(name):
    return re.sub(r'#([0-9a-fA-F]{2})', lambda m: chr(int(m.group(1), 16)), name)


def contains_name(data, names):
    # Iterative traversal avoids parser recursion on malicious dictionaries.
    pending = [data]
    while pending:
        value = pending.pop()
        if isinstance(value, dict):
            if any(decoded_name(key) in names for key in value):
                return True
            pending.extend(value.values())
        elif isinstance(value, list):
            pending.extend(value)
        elif isinstance(value, str) and decoded_name(value) in names:
            return True
    return False


def geometry(document):
    pages = document.get('pages', [])
    if not 1 <= len(pages) <= 10:
        raise ValueError('Page limit')
    objects = {}
    for group in document.get('qpdf', []):
        if isinstance(group, dict):
            objects.update(group)
    def resolve(ref):
        item = objects.get('obj:' + ref, {}) if isinstance(ref, str) else {}
        return item.get('value', {})
    result = []
    for page in pages:
        value = resolve(page['object'])
        effective = {}
        visited = set()
        for _ in range(32):
            if not isinstance(value, dict):
                raise ValueError('Invalid page tree')
            for key in ('/MediaBox', '/CropBox', '/Rotate', '/UserUnit'):
                if key in value and key not in effective:
                    effective[key] = value[key]
            parent = value.get('/Parent')
            if not parent:
                break
            if parent in visited:
                raise ValueError('Cyclic page tree')
            visited.add(parent)
            value = resolve(parent)
        else:
            raise ValueError('Deep page tree')
        media = effective.get('/MediaBox')
        if not isinstance(media, list) or len(media) != 4:
            # Unusual indirect geometry is unsupported, not rewritten blindly.
            raise ValueError('Unsupported geometry')
        result.append((media, effective.get('/CropBox', media), effective.get('/Rotate', 0), effective.get('/UserUnit', 1)))
    return result


def compress_certificate(cert, directory, saved, storage):
    result = {'id': str(cert.pk), 'participant_name': cert.participant.full_name,
              'status': 'skipped', 'reason': 'unsupported', 'original_bytes': 0, 'final_bytes': 0}
    if not cert.pdf_file:
        result['reason'] = 'missing'
        return result
    source = Path(directory) / 'original.pdf'
    candidate = Path(directory) / 'candidate.pdf'
    try:
        size = cert.pdf_file.storage.size(cert.pdf_file.name)
        result.update(original_bytes=size, final_bytes=size)
        if size > MAX_INPUT:
            result['reason'] = 'too_large'
            return result
        with cert.pdf_file.open('rb') as stream, source.open('wb') as output:
            remaining = MAX_INPUT + 1
            while remaining:
                chunk = stream.read(min(65536, remaining))
                if not chunk:
                    break
                output.write(chunk)
                remaining -= len(chunk)
        size = source.stat().st_size
        result.update(original_bytes=size, final_bytes=size)
        if size > MAX_INPUT:
            result['reason'] = 'too_large'
            return result
        # Decode escaped PDF name tokens even before parsing: fail closed on
        # signature markers, including damaged signed documents.
        with source.open('rb') as stream:
            tail = b''
            for chunk in iter(lambda: stream.read(65536), b''):
                raw = re.sub(rb'#([0-9a-fA-F]{2})', lambda m: bytes([int(m.group(1), 16)]), tail + chunk)
                if re.search(rb'/(?:Sig|ByteRange|Perms|SigFlags)(?=[\s/<>()\[\]{}%]|$)', raw):
                    result['reason'] = 'signed'
                    return result
                tail = chunk[-128:]
        deadline = time.monotonic() + 20
        document = run_qpdf('json', source, candidate, directory, deadline)
        if contains_name(document.get('qpdf', []), SIGNATURE_NAMES):
            result['reason'] = 'signed'
            return result
        if document.get('encrypt', {}).get('encrypted') or contains_name(document.get('qpdf', []), UNSAFE_NAMES):
            return result
        original_geometry = geometry(document)
        run_qpdf('check', source, candidate, directory, deadline)
        if size < TARGET:
            result['reason'] = 'already_small'
            return result
        run_qpdf('compress', source, candidate, directory, deadline)
        final_size = candidate.stat().st_size
        if final_size >= ACCEPT or final_size >= size:
            result['reason'] = 'too_large' if size >= ACCEPT else 'already_small'
            return result
        run_qpdf('check', candidate, candidate, directory, deadline)
        candidate_document = run_qpdf('json', candidate, candidate, directory, deadline)
        if geometry(candidate_document) != original_geometry or contains_name(candidate_document.get('qpdf', []), SIGNATURE_NAMES):
            return result
        intended = f'certificates/{cert.event_id}/compressed/{uuid.uuid4().hex}.pdf'
        saved.append(intended)
        with candidate.open('rb') as stream:
            name = storage.save(intended, File(stream), max_length=100)
        if name != intended:
            saved.append(name)
        cert.pdf_file.name = name
        cert.save(update_fields=['pdf_file', 'updated_at'])
        result.update(status='compressed', reason='compressed', final_bytes=final_size)
    except FileNotFoundError:
        result['reason'] = 'missing'
    except (ValueError, KeyError, TypeError, RecursionError, subprocess.TimeoutExpired):
        result['reason'] = 'unsupported'
    except Exception:
        logger.exception('Certificate compression failed for %s', cert.pk)
        raise
    return result


def cleanup(storage, names):
    for name in names:
        try:
            storage.delete(name)
        except Exception:
            logger.exception('Unable to remove new compression file %s', name)


def step_job(event_id, owner, job_id, processed=None):
    if processed is not None and (type(processed) is not int or processed < 0):
        raise ValidationError("processed harus bilangan bulat non-negatif.")
    event_id = valid_uuid(event_id, 'event_id')
    job_id = valid_uuid(job_id, 'job_id')
    # Fast scope check before returning a potentially busy global lock.
    get_object_or_404(CertificateCompressionJob, pk=job_id, event_id=event_id, owner=owner)
    saved, storage = [], final_storage()
    try:
        with compressor_lock(), transaction.atomic():
            event = get_object_or_404(Event.objects.select_for_update(), pk=event_id)
            job = get_object_or_404(CertificateCompressionJob.objects.select_for_update(), pk=job_id, event=event, owner=owner)
            if processed is not None:
                if processed > job.processed:
                    raise ValidationError('Progres lebih maju dari pekerjaan tersimpan.')
                if processed < job.processed:
                    return payload(job)
            if job.processed >= len(job.certificate_ids):
                return payload(job)
            pk = job.certificate_ids[job.processed]
            cert = Certificate.objects.select_for_update().filter(pk=pk, event=event).first()
            if cert is None:
                row = {'id': pk, 'participant_name': '', 'status': 'skipped', 'reason': 'missing', 'original_bytes': 0, 'final_bytes': 0}
            else:
                try:
                    # Savepoint makes storage/save failures non-mutating while
                    # still persisting an error result for this snapshot row.
                    with transaction.atomic(), tempfile.TemporaryDirectory(prefix='cert-compress-') as directory:
                        row = compress_certificate(cert, directory, saved, storage)
                except Exception:
                    cleanup(storage, saved)
                    saved.clear()
                    row = {'id': pk, 'participant_name': cert.participant.full_name, 'status': 'error', 'reason': 'error', 'original_bytes': 0, 'final_bytes': 0}
            job.results = [*job.results, row]
            job.processed += 1
            job.save(update_fields=['results', 'processed', 'updated_at'])
            return payload(job)
    except Exception:
        cleanup(storage, saved)
        raise
