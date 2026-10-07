"""Review-first import of final PDFs. Never render, overlay or infer attendance."""
import hashlib
import io
import json
import logging
import re
import unicodedata
import uuid
import tempfile
from contextlib import ExitStack
from collections import Counter
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile, File
from django.core.files.storage import FileSystemStorage
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from rest_framework.exceptions import ValidationError

from apps.attendance.models import Attendance
from apps.events.models import Event
from apps.participants.models import Participant
from .matcher import extract_certificate_number
from .models import Certificate, CertificateImportBatch, CertificateImportItem

logger = logging.getLogger(__name__)


def private_storage():
    # Deliberately outside MEDIA_ROOT: no publicly accessible preview URLs.
    root = getattr(settings, 'CERTIFICATE_IMPORT_ROOT', Path(settings.MEDIA_ROOT).parent / 'private_certificate_imports')
    return FileSystemStorage(location=root)


def eligible(event):
    return Participant.objects.filter(event=event, pk__in=Attendance.objects.filter(
        event=event, status=Attendance.Status.HADIR).values('participant_id')).order_by('full_name', 'id')


def snapshot(event):
    state = {
        'participants': list(Participant.objects.filter(event=event).order_by('id').values('id', 'full_name', 'nik', 'nip', 'updated_at')),
        'attendance': list(Attendance.objects.filter(event=event).order_by('pk').values('pk', 'participant_id', 'status')),
        'certificates': list(Certificate.objects.filter(event=event).order_by('id').values('id', 'participant_id', 'updated_at', 'pdf_file', 'source', 'status')),
    }
    return hashlib.sha256(json.dumps(state, default=str, sort_keys=True).encode()).hexdigest()


def normalize(text):
    text = unicodedata.normalize('NFKC', text).casefold()
    return ' '.join(re.sub(r'[^\w\s]', ' ', text).split())


def match_name(text, all_people, eligible_ids):
    """Conservative: exact full-name + recipient anchor; any extra name is ambiguous.

    No fuzzy/token/NIK/filename matching. Unanchored names may be signatories,
    so they always require manual review. All event names (not only attendees)
    are scanned to prevent shorter/overlapping and non-attendee signer matches.
    """
    normalized = ' ' + normalize(text) + ' '
    hits = [p for p in all_people if normalize(p.full_name) and ' ' + normalize(p.full_name) + ' ' in normalized]
    if len(hits) > 1:
        return None, '', 'ambiguous'
    if not hits:
        return None, '', 'unmatched'
    person = hits[0]
    name = normalize(person.full_name)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    recipients = []
    anchor = re.compile(r'(?:diberikan\s+kepada|dipersembahkan\s+kepada|presented\s+to|awarded\s+to|kepada)\s*:?\s*(.*)', re.I)
    for i, line in enumerate(lines):
        found = anchor.fullmatch(line)
        if found:
            recipients.append(normalize(found.group(1) or (lines[i + 1] if i + 1 < len(lines) else '')))
    # Repeated name anywhere else can be a signer, even if same person/name.
    occurrences = len(re.findall(r'(?<!\w)' + re.escape(name) + r'(?!\w)', normalize(text)))
    if recipients == [name] and occurrences == 1 and person.pk in eligible_ids:
        return person, person.full_name, 'matched'
    return None, person.full_name, 'needs_review'


def positive_integer(value, field):
    if isinstance(value, bool) or not re.fullmatch(r'[0-9]+', str(value)) or int(value) < 1:
        raise ValidationError(f'{field} harus bilangan bulat positif.')
    return int(value)


def groups_for(count, data):
    raw = data.get('page_groups')
    if raw not in (None, ''):
        try:
            groups = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, ValueError):
            raise ValidationError('page_groups harus JSON valid.')
        if not isinstance(groups, list) or not groups:
            raise ValidationError('page_groups harus list non-kosong.')
        result, covered = [], []
        for group in groups:
            if not isinstance(group, dict) or set(group) != {'start', 'end'}:
                raise ValidationError('Setiap page_groups wajib start dan end.')
            start = positive_integer(group['start'], 'start')
            end = positive_integer(group['end'], 'end')
            if start > end or end > count:
                raise ValidationError('Rentang halaman tidak valid.')
            result.append((start, end))
            covered.extend(range(start, end + 1))
        if sorted(covered) != list(range(1, count + 1)):
            raise ValidationError('page_groups harus mencakup semua halaman tanpa tumpang tindih.')
        return sorted(result)
    size = positive_integer(data.get('pages_per_participant', 1), 'pages_per_participant')
    if count % size:
        raise ValidationError('Jumlah halaman tidak habis dibagi pages_per_participant; gunakan page_groups.')
    return [(start, start + size - 1) for start in range(1, count + 1, size)]


def delete_files(storage, paths):
    for path in paths:
        try:
            storage.delete(path)
        except OSError:
            logger.exception('Unable to clean certificate import file %s', path)


def purge_expired(owner):
    storage = private_storage()
    for batch in CertificateImportBatch.objects.filter(owner=owner, expires_at__lte=timezone.now(), applied_at__isnull=True):
        delete_files(storage, batch.items.values_list('private_path', flat=True))
        batch.delete()


def create_preview(event, owner, files, data):
    # Shared PDF resources can amplify output when split. Spill chunks to disk
    # instead of retaining every resulting PDF in memory on this small host.
    with ExitStack() as temporary_files:
        return _create_preview(event, owner, files, data, temporary_files)


def _create_preview(event, owner, files, data, temporary_files):
    mode = data.get('mode', 'combined')
    if mode not in ('combined', 'separate'):
        raise ValidationError('mode harus combined atau separate.')
    if not files or len(files) > 100:
        raise ValidationError('Unggah 1 sampai 100 file PDF.')
    if sum(f.size for f in files) > 50 * 1024 * 1024:
        raise ValidationError('Ukuran total maksimal 50MB.')
    if mode == 'combined' and len(files) != 1:
        raise ValidationError('Mode combined membutuhkan tepat satu PDF.')
    if mode == 'separate' and data.get('page_groups') not in (None, ''):
        raise ValidationError('page_groups hanya untuk mode combined.')
    initial_snapshot = snapshot(event)
    people = list(event.participants.all())
    participants = list(eligible(event))
    eligible_ids = {p.pk for p in participants}
    prepared, pages_total = [], 0
    for f in files:
        if not f.name.lower().endswith('.pdf'):
            raise ValidationError('Semua file harus PDF.')
        content = f.read()
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                raise ValueError('PDF terenkripsi tidak didukung')
            count = len(reader.pages)
            if not count:
                raise ValueError('PDF kosong')
            pages_total += count
            if pages_total > 200:
                raise ValidationError('Total maksimal 200 halaman.')
            groups = [(1, count)] if mode == 'separate' else groups_for(count, data)
            for start, end in groups:
                text = '\n'.join(reader.pages[i].extract_text() or '' for i in range(start - 1, end))
                person, detected, match_status = match_name(text, people, eligible_ids)
                if mode == 'separate':
                    result = content  # Byte-for-byte original final PDF.
                else:
                    writer = PdfWriter()
                    for i in range(start - 1, end):
                        writer.add_page(reader.pages[i])
                    output = temporary_files.enter_context(tempfile.SpooledTemporaryFile(max_size=256 * 1024))
                    writer.write(output)
                    output.seek(0)
                    result = output
                prepared.append((dict(filename=Path(f.name).name[:255], page_start=start, page_end=end,
                    detected_name=detected, participant=person, match_status=match_status,
                    certificate_number=(extract_certificate_number(text) or '')[:100]), result))
        except ValidationError:
            raise
        except Exception as exc:
            raise ValidationError('PDF rusak, terenkripsi, atau tidak dapat dibaca.') from exc
    duplicates = Counter(str(fields['participant'].pk) for fields, _ in prepared if fields['participant'])
    for fields, _ in prepared:
        if fields['participant'] and duplicates[str(fields['participant'].pk)] > 1:
            fields['participant'] = None
            fields['match_status'] = 'duplicate'
    storage, saved = private_storage(), []
    purge_expired(owner)
    try:
        with transaction.atomic():
            Event.objects.select_for_update().get(pk=event.pk)
            if snapshot(event) != initial_snapshot:
                raise ValidationError('Data peserta berubah; ulangi preview.')
            batch = CertificateImportBatch.objects.create(event=event, owner=owner,
                snapshot=initial_snapshot, expires_at=timezone.now() + timedelta(hours=24))
            items = []
            for fields, content in prepared:
                intended = f'{batch.pk}/{uuid.uuid4().hex}.pdf'
                saved.append(intended)
                upload = ContentFile(content) if isinstance(content, bytes) else File(content)
                name = storage.save(intended, upload)
                if name != intended:
                    saved.append(name)
                items.append(CertificateImportItem.objects.create(batch=batch, private_path=name, **fields))
        return batch, items, participants
    except Exception:
        delete_files(storage, saved)
        raise


def scoped_batch(event, owner, batch_id, lock=False):
    try:
        batch_id = uuid.UUID(str(batch_id))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError('batch_id tidak valid.')
    qs = CertificateImportBatch.objects
    if lock:
        qs = qs.select_for_update()
    batch = get_object_or_404(qs, pk=batch_id, event=event, owner=owner)
    if batch.applied_at or batch.expires_at <= timezone.now():
        raise ValidationError('Batch sudah diterapkan atau kedaluwarsa; ulangi preview.')
    return batch


def apply_import(event, owner, data):
    if not isinstance(data, dict):
        raise ValidationError('Payload harus objek JSON.')
    assignments = data.get('assignments')
    replace = data.get('replace_existing', False)
    if not isinstance(replace, bool):
        raise ValidationError('replace_existing harus boolean.')
    if not isinstance(assignments, list) or not assignments or len(assignments) > 200:
        raise ValidationError('assignments harus list non-kosong, maksimal 200.')
    saved, old_files = [], []
    private = private_storage()
    final_storage = Certificate._meta.get_field('pdf_file').storage
    try:
        with transaction.atomic():
            Event.objects.select_for_update().get(pk=event.pk)
            batch = scoped_batch(event, owner, data.get('batch_id'), lock=True)
            # Hold locks on mutable attendance/identity rows through the write.
            list(Participant.objects.select_for_update().filter(event=event).values_list('pk', flat=True))
            list(Attendance.objects.select_for_update().filter(event=event).values_list('pk', flat=True))
            list(Certificate.objects.select_for_update().filter(event=event).values_list('pk', flat=True))
            if snapshot(event) != batch.snapshot:
                raise ValidationError('Batch tidak lagi sesuai data terkini; ulangi preview.')
            items = {str(item.pk): item for item in batch.items.all()}
            participants = {str(p.pk): p for p in eligible(event).select_for_update()}
            existing = {str(c.participant_id): c for c in Certificate.objects.select_for_update().filter(event=event)}
            used_items, used_people, validated = set(), set(), []
            for assignment in assignments:
                if not isinstance(assignment, dict):
                    raise ValidationError('Assignment tidak valid.')
                item_id = str(assignment.get('item_id', ''))
                if item_id not in items or item_id in used_items:
                    raise ValidationError('Item asing atau duplikat.')
                used_items.add(item_id)
                pid = assignment.get('participant_id')
                if pid in (None, ''):  # Explicitly skipped item.
                    continue
                pid = str(pid)
                if pid not in participants or pid in used_people:
                    raise ValidationError('Peserta harus hadir pada kegiatan ini dan tidak boleh duplikat.')
                used_people.add(pid)
                if pid in existing and not replace:
                    raise ValidationError('Peserta sudah memiliki sertifikat; replace_existing wajib true.')
                number = assignment.get('certificate_number', '')
                if number is None:
                    number = ''
                if not isinstance(number, str) or len(number.strip()) > 100:
                    raise ValidationError('Nomor sertifikat maksimal 100 karakter.')
                if not private.exists(items[item_id].private_path):
                    raise ValidationError('File preview hilang; ulangi preview.')
                validated.append((items[item_id], participants[pid], existing.get(pid), number.strip()))
            if not validated:
                raise ValidationError('Pilih minimal satu peserta.')
            certificates = []
            for item, participant, cert, number in validated:
                cert = cert or Certificate(event=event, participant=participant)
                if cert.pdf_file:
                    old_files.append(cert.pdf_file.name)
                cert.source = Certificate.Source.UPLOADED
                cert.status = Certificate.Status.AVAILABLE
                cert.certificate_number = number
                cert.number_format = None
                # Use random file identity, never the optional certificate number.
                intended = f'certificates/{event.pk}/final-{uuid.uuid4().hex}.pdf'
                saved.append(intended)
                with private.open(item.private_path, 'rb') as f:
                    path = final_storage.save(intended, f)
                if path != intended:
                    saved.append(path)
                cert.pdf_file.name = path
                cert.save()
                certificates.append(cert)
            batch.applied_at = timezone.now()
            batch.save(update_fields=['applied_at'])
            private_paths = list(batch.items.values_list('private_path', flat=True))
            transaction.on_commit(lambda: delete_files(final_storage, old_files))
            transaction.on_commit(lambda: delete_files(private, private_paths))
        return certificates
    except Exception:
        delete_files(final_storage, saved)
        raise
