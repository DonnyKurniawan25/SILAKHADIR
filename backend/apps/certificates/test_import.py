import io
import json
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from reportlab.pdfgen import canvas
from pypdf import PdfReader

from apps.accounts.models import User
from apps.attendance.models import Attendance
from apps.events.models import Event
from apps.participants.models import Participant
from .models import Certificate


def pdf(*texts, name='canva.pdf'):
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(600, 400))
    for text in texts:
        t = c.beginText(50, 350)
        for line in text.split('\n'):
            t.textLine(line)
        c.drawText(t)
        c.showPage()
    c.save()
    return SimpleUploadedFile(name, stream.getvalue(), content_type='application/pdf')


class FinalImportTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.temp.name + '/media', CERTIFICATE_IMPORT_ROOT=self.temp.name + '/private')
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.user = User.objects.create_user(username='admin', role=User.Role.SUPERADMIN)
        now = timezone.now()
        self.event = Event.objects.create(title='Canva', start_date=now, end_date=now + timedelta(hours=1))
        self.person = self.person_named('Siti Aminah', 1)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f'/api/events/{self.event.pk}/certificates/'

    def person_named(self, name, index, hadir=True):
        p = Participant.objects.create(event=self.event, full_name=name, nik=str(index).zfill(16))
        if hadir:
            Attendance.objects.create(event=self.event, participant=p, status=Attendance.Status.HADIR)
        return p

    def preview(self, files=None, **data):
        return self.client.post(self.url + 'import-preview/', {'files': files or [pdf('Diberikan kepada\nSiti Aminah')], 'mode': 'combined', **data}, format='multipart')

    def apply(self, preview, participant=None, **data):
        return self.client.post(self.url + 'import-apply/', {'batch_id': preview.data['batch_id'], 'assignments': [{'item_id': preview.data['items'][0]['id'], 'participant_id': str((participant or self.person).pk)}], **data}, format='json')

    def test_preview_apply_optional_number_and_no_overlay(self):
        response = self.preview()
        self.assertEqual(response.status_code, 200, response.data)
        item = response.data['items'][0]
        self.assertEqual(item['participant_id'], str(self.person.pk))
        self.assertEqual(item['match_status'], 'matched')
        self.assertEqual(response.data['participants'][0]['full_name'], 'Siti Aminah')
        preview_file = self.client.get(item['preview_url'])
        self.assertEqual(preview_file.status_code, 200)
        original = b''.join(preview_file.streaming_content)
        self.assertEqual(self.apply(response).status_code, 200)
        cert = Certificate.objects.get()
        self.assertEqual(cert.source, 'uploaded')
        self.assertEqual(cert.status, 'tersedia')
        self.assertEqual(cert.certificate_number, '')
        self.assertFalse(cert.qr_code)
        with cert.pdf_file.open('rb') as f:
            self.assertEqual(f.read(), original)
        self.assertEqual(self.apply(response).status_code, 400)

    def test_variable_groups_and_invalid_coverage(self):
        upload = lambda: [pdf('Diberikan kepada\nSiti Aminah', 'Design back', 'Other')]
        response = self.preview(upload(), page_groups=json.dumps([{'start': 1, 'end': 2}, {'start': 3, 'end': 3}]))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([i['page_count'] for i in response.data['items']], [2, 1])
        for groups in ([{'start': 1, 'end': 2}], [{'start': 1, 'end': 2}, {'start': 2, 'end': 3}], [{'start': 0, 'end': 3}]):
            self.assertEqual(self.preview(upload(), page_groups=json.dumps(groups)).status_code, 400)
        self.assertEqual(self.preview(upload(), pages_per_participant=2).status_code, 400)

    def test_separate_keeps_whole_pdf_bytes(self):
        f = pdf('Siti Aminah', 'Back')
        original = f.read()
        f.seek(0)
        response = self.preview([f], mode='separate')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['items'][0]['page_count'], 2)
        downloaded = self.client.get(response.data['items'][0]['preview_url'])
        self.assertEqual(b''.join(downloaded.streaming_content), original)

    def test_large_separate_final_pdf_remains_byte_exact(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, NameObject
        source = pdf('Siti Aminah')
        reader = PdfReader(source)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        page = writer.pages[0]
        stream = DecodedStreamObject()
        stream.set_data(page.get_contents().get_data() + b'\n% QA padding\n' * 100000)
        page[NameObject('/Contents')] = writer._add_object(stream)
        output = io.BytesIO()
        writer.write(output)
        original = output.getvalue()
        self.assertGreater(len(original), 1_000_000)
        response = self.preview([SimpleUploadedFile('final.pdf', original, content_type='application/pdf')], mode='separate')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.apply(response).status_code, 200)
        with Certificate.objects.get().pdf_file.open('rb') as final:
            self.assertEqual(final.read(), original)

    def test_match_refuses_overlaps_duplicates_and_signers(self):
        self.person_named('Siti Aminah Putri', 2)
        response = self.preview([pdf('Diberikan kepada\nSiti Aminah Putri')])
        self.assertIsNone(response.data['items'][0]['participant_id'])
        self.assertEqual(response.data['items'][0]['match_status'], 'ambiguous')
        response = self.preview([pdf('Diberikan kepada\nUnknown Recipient\nKepala Dinas\nSiti Aminah')])
        self.assertIsNone(response.data['items'][0]['participant_id'])
        self.person_named('Siti Aminah', 3)
        response = self.preview()
        self.assertIsNone(response.data['items'][0]['participant_id'])

    def test_eligibility_owner_expiry_and_stale(self):
        absent = self.person_named('Tidak Hadir', 2, hadir=False)
        response = self.preview()
        self.assertEqual(len(response.data['participants']), 1)
        self.assertEqual(self.apply(response, absent).status_code, 400)
        other = User.objects.create_user(username='other', role=User.Role.SUPERADMIN)
        self.client.force_authenticate(other)
        self.assertEqual(self.apply(response).status_code, 404)
        self.assertEqual(self.client.get(response.data['items'][0]['preview_url']).status_code, 404)
        self.client.force_authenticate(self.user)
        from .models import CertificateImportBatch
        CertificateImportBatch.objects.filter(pk=response.data['batch_id']).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.apply(response).status_code, 400)
        response = self.preview()
        self.person.full_name = 'Changed'
        self.person.save()
        self.assertEqual(self.apply(response).status_code, 400)

    def test_replace_explicit_and_generated_does_not_touch_upload(self):
        response = self.preview()
        self.assertEqual(self.apply(response).status_code, 200)
        cert = Certificate.objects.get()
        name = cert.pdf_file.name
        self.client.post(self.url + 'generate/', {'regenerate': True}, format='json')
        self.client.post(self.url + str(cert.pk) + '/set-number/', {'certificate_number': 'NEW'}, format='json')
        cert.refresh_from_db()
        self.assertEqual(cert.pdf_file.name, name)
        self.assertEqual(cert.status, 'tersedia')
        response = self.preview()
        self.assertEqual(self.apply(response).status_code, 400)
        self.assertEqual(self.apply(response, replace_existing=True).status_code, 200)

    def test_duplicates_invalid_files_and_limits(self):
        response = self.preview([pdf('Diberikan kepada\nSiti Aminah', 'Diberikan kepada\nSiti Aminah')])
        items = response.data['items']
        self.assertTrue(all(i['participant_id'] is None for i in items))
        result = self.client.post(self.url + 'import-apply/', {'batch_id': response.data['batch_id'], 'assignments': [{'item_id': i['id'], 'participant_id': str(self.person.pk)} for i in items]}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.preview([SimpleUploadedFile('bad.pdf', b'not pdf')]).status_code, 400)
        self.assertEqual(self.preview([pdf('x')], pages_per_participant='0').status_code, 400)
        self.assertEqual(self.preview([pdf('x') for _ in range(101)], mode='separate').status_code, 400)
        self.assertEqual(self.preview([pdf(*(['x'] * 201))]).status_code, 400)

    def test_storage_failure_rolls_back_certificates(self):
        response = self.preview()
        with patch('django.core.files.storage.FileSystemStorage._save', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.apply(response)
        self.assertEqual(Certificate.objects.count(), 0)
        self.assertEqual(self.apply(response).status_code, 200)

    def test_manual_correction_unmatched_and_skip(self):
        response = self.preview([pdf('image only', 'unmatched')])
        result = self.apply(response)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(Certificate.objects.count(), 1)
        self.assertEqual(Participant.objects.count(), 1)

    def test_foreign_event_and_item_rejected(self):
        first, second = self.preview(), self.preview()
        result = self.client.post(self.url + 'import-apply/', {
            'batch_id': first.data['batch_id'], 'assignments': [{
                'item_id': second.data['items'][0]['id'], 'participant_id': str(self.person.pk),
            }],
        }, format='json')
        self.assertEqual(result.status_code, 400)
        now = timezone.now()
        other = Event.objects.create(title='Other', start_date=now, end_date=now + timedelta(hours=1))
        result = self.client.post(f'/api/events/{other.pk}/certificates/import-apply/', {
            'batch_id': first.data['batch_id'], 'assignments': [{'item_id': first.data['items'][0]['id'], 'participant_id': str(self.person.pk)}],
        }, format='json')
        self.assertEqual(result.status_code, 404)
        self.assertFalse(Certificate.objects.exists())

    def test_second_file_failure_cleans_first_file_and_rolls_back(self):
        from pathlib import Path
        from django.conf import settings
        from django.core.files.storage import FileSystemStorage
        other = self.person_named('Budi Santoso', 2)
        response = self.preview([pdf('Siti Aminah', 'Budi Santoso')])
        assignments = [{'item_id': item['id'], 'participant_id': str(person.pk)} for item, person in zip(response.data['items'], (self.person, other))]
        original = FileSystemStorage._save
        calls = []
        def fail_second(storage, name, content):
            calls.append(name)
            if len(calls) == 2:
                raise OSError('second file failed')
            return original(storage, name, content)
        with patch.object(FileSystemStorage, '_save', fail_second):
            with self.assertRaises(OSError):
                self.client.post(self.url + 'import-apply/', {'batch_id': response.data['batch_id'], 'assignments': assignments}, format='json')
        self.assertFalse(Certificate.objects.exists())
        self.assertEqual(list(Path(settings.MEDIA_ROOT).rglob('*.pdf')), [])
        self.assertEqual(self.client.post(self.url + 'import-apply/', {'batch_id': response.data['batch_id'], 'assignments': assignments}, format='json').status_code, 200)

    def test_preview_disk_failure_leaves_no_batch_or_private_pdf(self):
        from pathlib import Path
        from django.conf import settings
        from .models import CertificateImportBatch
        with patch('django.core.files.storage.FileSystemStorage._save', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.preview()
        self.assertFalse(CertificateImportBatch.objects.exists())
        self.assertEqual(list(Path(settings.CERTIFICATE_IMPORT_ROOT).rglob('*.pdf')), [])

    def test_limits_size_and_encrypted_pdf(self):
        from pypdf import PdfWriter
        from .imports import create_preview
        large = pdf('x')
        large.size = 50 * 1024 * 1024 + 1
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            create_preview(self.event, self.user, [large], {'mode': 'combined'})
        writer = PdfWriter()
        writer.add_blank_page(width=600, height=400)
        writer.encrypt('secret')
        stream = io.BytesIO()
        writer.write(stream)
        self.assertEqual(self.preview([SimpleUploadedFile('encrypted.pdf', stream.getvalue())]).status_code, 400)

    def test_split_preserves_page_content_and_dimensions(self):
        source = pdf('Diberikan kepada\nSiti Aminah', 'Back design')
        original = PdfReader(io.BytesIO(source.read()))
        source.seek(0)
        response = self.preview([source], pages_per_participant=2)
        self.assertEqual(response.status_code, 200, response.data)
        downloaded = self.client.get(response.data['items'][0]['preview_url'])
        split = PdfReader(io.BytesIO(b''.join(downloaded.streaming_content)))
        self.assertEqual(len(split.pages), 2)
        for before, after in zip(original.pages, split.pages):
            self.assertEqual(before.get_contents().get_data(), after.get_contents().get_data())
            self.assertEqual(before.mediabox, after.mediabox)
            self.assertEqual(before.extract_text(), after.extract_text())

    def test_successful_commit_cleans_preview_and_replaced_file(self):
        from .imports import private_storage
        from .models import CertificateImportItem
        response = self.preview()
        item = CertificateImportItem.objects.get(pk=response.data['items'][0]['id'])
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.apply(response).status_code, 200)
        self.assertFalse(private_storage().exists(item.private_path))
        old = Certificate.objects.get().pdf_file
        old_path, storage = old.name, old.storage
        response = self.preview()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.apply(response, replace_existing=True).status_code, 200)
        self.assertFalse(storage.exists(old_path))
        self.assertTrue(storage.exists(Certificate.objects.get().pdf_file.name))

    def test_import_requires_admin(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.preview().status_code, 401)
        operator = User.objects.create_user(username='op', role=User.Role.OPERATOR)
        self.client.force_authenticate(operator)
        self.assertEqual(self.preview().status_code, 403)
