import io
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.participants.models import Participant
from .models import Certificate


class PublicCertificateTests(TestCase):
    check_url = '/api/public/certificates/check/'
    nik = '5201010101010001'
    nip = '198001012010011001'

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        override = override_settings(MEDIA_ROOT=temp.name)
        override.enable()
        self.addCleanup(override.disable)
        self.client = APIClient()
        now = timezone.now()
        self.event = Event.objects.create(title='Public event', start_date=now, end_date=now + timedelta(hours=1))
        self.participant = Participant.objects.create(event=self.event, full_name='Participant', nik=None, nip=self.nip, email='private@example.com', phone='private')
        self.cert = Certificate.objects.create(event=self.event, participant=self.participant, status='diproses', source='uploaded')
        stream = io.BytesIO()
        pdf = canvas.Canvas(stream)
        pdf.drawString(10, 10, 'Original uploaded certificate')
        pdf.save()
        self.original = stream.getvalue()
        self.cert.pdf_file.save('original.pdf', SimpleUploadedFile('original.pdf', self.original))

    def download(self):
        return self.client.get(f'/api/public/certificates/download/{self.cert.download_token}/')

    def result(self, params=None):
        response = self.client.get(self.check_url, params or {'identity': self.nip})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['found'], response.data)
        return response.data['results'][0]

    def test_nip_only_lookup_all_aliases_and_exact_nik(self):
        for key in ('nip', 'nik', 'identity', 'identity_number'):
            with self.subTest(key=key):
                self.assertEqual(self.result({key: f' {self.nip} '})['id'], str(self.cert.pk))
        self.participant.nik = self.nik
        self.participant.save()
        for key in ('nik', 'identity', 'identity_number'):
            self.assertEqual(self.result({key: self.nik})['id'], str(self.cert.pk))
        self.assertEqual(self.result({'nik': self.nik, 'nip': self.nip})['id'], str(self.cert.pk))

    def test_multiple_identifiers_use_or_and_blank_nik_allows_nip(self):
        other = Participant.objects.create(event=self.event, full_name='Same name', nik=self.nik)
        other_cert = Certificate.objects.create(event=self.event, participant=other, status='diproses')
        response = self.client.get(self.check_url, {'nik': self.nik, 'nip': self.nip})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual({row['id'] for row in response.data['results']}, {str(self.cert.pk), str(other_cert.pk)})
        self.assertEqual(self.result({'nik': '', 'nip': self.nip})['id'], str(self.cert.pk))

    def test_existing_generated_pdf_downloadable_without_regeneration(self):
        self.cert.source = 'generated'
        self.cert.save()
        self.assertTrue(self.result()['can_download'])
        response = self.download()
        self.assertIn('attachment;', response['Content-Disposition'])
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertEqual(b''.join(response.streaming_content), self.original)
        response.close()

    def test_validation_and_no_name_search(self):
        for params in ({}, {'identity': 'Participant'}, {'identity': '123'}, {'nik': 'a' * 16}, {'nip': self.nik}, {'identity': '１' * 16}, {'identity': self.nip, 'event_id': 'bad'}, {'identity': self.nip, 'nik': 'bad'}):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(self.check_url, params).status_code, 400)
        response = self.client.get(self.check_url, {'identity': '0' * 16, 'search': 'Participant'})
        self.assertFalse(response.data['found'])

    def test_event_filter_privacy_and_null_thumbnail(self):
        row = self.result({'identity': self.nip, 'event_id': str(self.event.pk)})
        self.assertIsNone(row['thumbnail_url'])
        for field in ('nik', 'nip', 'email', 'phone', 'participant', 'pdf_file', 'download_token'):
            self.assertNotIn(field, row)
        import uuid
        self.assertFalse(self.client.get(self.check_url, {'identity': self.nip, 'event_id': str(uuid.uuid4())}).data['found'])

    def test_thumbnail_url(self):
        self.event.thumbnail.save('event.png', SimpleUploadedFile('event.png', b'event image'))
        self.assertEqual(self.result()['thumbnail_url'], 'https://silakhadir.web.id' + self.event.thumbnail.url)

    def test_processing_pdf_download_preserves_bytes_and_verification_contract(self):
        for state in ('diproses', 'tersedia'):
            self.cert.status = state
            self.cert.save()
            row = self.result()
            self.assertTrue(row['can_download'])
            self.assertIn(self.cert.download_token, row['download_url'])
            response = self.download()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b''.join(response.streaming_content), self.original)
            response.close()
            verify = self.client.get(f'/api/public/certificates/verify/{self.cert.verification_token}/')
            self.assertEqual(verify.data['valid'], state == 'tersedia')
        self.cert.refresh_from_db()
        self.assertEqual(self.cert.source, 'uploaded')

    def test_missing_empty_non_pdf_files_no_download_or_generation(self):
        self.cert.pdf_file.storage.delete(self.cert.pdf_file.name)
        self.assertFalse(self.result()['can_download'])
        self.assertIsNone(self.result()['download_url'])
        self.assertEqual(self.download().status_code, 404)
        self.cert.pdf_file.save('not.pdf', SimpleUploadedFile('not.pdf', b'not a PDF'))
        self.assertFalse(self.result()['can_download'])
        self.assertEqual(self.download().status_code, 404)
        self.cert.pdf_file = None
        self.cert.save()
        self.assertIsNone(self.result()['download_url'])
        self.assertEqual(self.download().status_code, 404)

    def test_storage_failure_and_revoked(self):
        with patch('django.core.files.storage.FileSystemStorage.open', side_effect=OSError('offline')):
            self.assertFalse(self.result()['can_download'])
            self.assertEqual(self.download().status_code, 404)
        self.cert.status = 'dicabut'
        self.cert.save()
        self.assertFalse(self.client.get(self.check_url, {'identity': self.nip}).data['found'])
        self.assertEqual(self.download().status_code, 404)
