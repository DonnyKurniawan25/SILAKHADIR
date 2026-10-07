"""Small real PDF fixtures; metadata edits never regenerate signed artifacts."""
import io
import uuid
from unittest.mock import patch
from django.test import SimpleTestCase, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models.query import QuerySet
from reportlab.pdfgen import canvas
from apps.accounts.models import User
from .matcher import extract_certificate_number, extract_text_from_pdf
from .models import Certificate
from .test_verification import CertificateVerificationTests


class NumberExtractionTests(SimpleTestCase):
    def test_explicit_labels_and_multiline_real_pdf(self):
        for text, expected in [('No: 001', '001'), ('No. : 12/ABC', '12/ABC'),
                               ('Nomor Sertifikat:\n123/ABC/2026', '123/ABC/2026'),
                               ('No\n:\n001-ABC', '001-ABC'),
                               ('No: 12 / ABC / 2026', '12/ABC/2026')]:
            with self.subTest(text=text):
                stream = io.BytesIO()
                pdf = canvas.Canvas(stream)
                for i, line in enumerate(text.splitlines()):
                    pdf.drawString(20, 800 - i * 20, line)
                pdf.save()
                self.assertEqual(extract_certificate_number(extract_text_from_pdf(stream)), expected)

    def test_reject_ambiguous_dates_identity_and_oversized(self):
        for text in ['Tanggal 12/10/2026', 'NIP: 198001012000011001',
                     'No: 198001012000011001', 'No: 12/10/2026',
                     'No: 2026-10-12', 'No: 001\nNo: 002',
                     'No: 001 atau 002', 'No: ' + '1' * 101,
                     'No: 001\nNo: ' + '1' * 101, 'No: NIP\n198001012000011001']:
            with self.subTest(text=text):
                self.assertIsNone(extract_certificate_number(text))
        self.assertEqual(extract_certificate_number('No: 001\nNo: 001'), '001')


class CertificateNumberTests(TestCase):
    setUp = CertificateVerificationTests.setUp
    make_certificate = CertificateVerificationTests.make_certificate
    post = CertificateVerificationTests.post

    def test_control_characters_and_event_lock(self):
        for ch in ('\n', '\r', '\x00', '\x7f', '\u202e'):
            self.assertEqual(self.post('number', {'certificate_number': '001' + ch}).status_code, 400)
        from apps.events.models import Event
        original = Event.objects.select_for_update
        with patch.object(Event.objects, 'select_for_update', wraps=original) as lock:
            self.assertEqual(self.post('number', {'certificate_number': '001'}).status_code, 200)
            lock.assert_called_once()

    def test_budget_fallback_keeps_all_names_including_offpage(self):
        from .bounded_detector import DetectionBudget
        second = self.make_certificate()
        with patch('apps.certificates.bounded_detector.DetectionBudget', return_value=DetectionBudget(max_files=0)):
            response = self.client.post(self.url + 'detect-numbers/?page=999&search=absent', {}, format='json')
        self.assertEqual(response.status_code, 200)
        rows = {row['id']: row for row in response.data['items']}
        self.assertEqual(set(rows), {str(self.cert.pk), str(second.pk)})
        for cert in (self.cert, second):
            self.assertEqual(rows[str(cert.pk)]['participant_name'], cert.participant.full_name)
            self.assertEqual(rows[str(cert.pk)]['detected_number'], '')
            self.assertNotIn('nik', rows[str(cert.pk)])

    def test_single_and_all_preserve_every_artifact_and_status(self):
        second = self.make_certificate()
        foreign = self.make_certificate(event=self.other)
        self.cert.status = Certificate.Status.AVAILABLE
        self.cert.save()
        self.cert.qr_code.save('qr.png', SimpleUploadedFile('qr.png', b'original-qr'))
        name = self.cert.pdf_file.name
        original = self.cert.pdf_file.read()
        tokens = (self.cert.verification_token, self.cert.download_token, self.cert.qr_code.name)
        response = self.post('number', {'certificate_number': '99/ABC', 'certificate_id': str(self.cert.pk)})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated_count'], 1)
        second.refresh_from_db()
        self.assertEqual(second.certificate_number, '')
        response = self.client.post(self.url + 'number/?page=999&search=absent&status=dicabut', {'certificate_number': 'common'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated_count'], 2)
        self.cert.refresh_from_db()
        second.refresh_from_db()
        foreign.refresh_from_db()
        self.assertEqual((self.cert.certificate_number, second.certificate_number, foreign.certificate_number), ('common', 'common', ''))
        self.assertEqual(self.cert.status, Certificate.Status.AVAILABLE)
        self.assertEqual(self.cert.pdf_file.name, name)
        self.assertEqual(self.cert.pdf_file.read(), original)
        self.assertEqual((self.cert.verification_token, self.cert.download_token, self.cert.qr_code.name), tokens)
        self.assertEqual(self.cert.qr_code.read(), b'original-qr')
        self.assertEqual(self.post('number', {'certificate_number': ''}).status_code, 200)
        self.assertEqual(self.post('number', {'certificate_number': 'x' * 100}).status_code, 200)

    def test_validation_scope_and_auth(self):
        foreign = self.make_certificate(event=self.other)
        for data in [{}, [], {'certificate_number': None}, {'certificate_number': 12},
                     {'certificate_number': True}, {'certificate_number': 'x' * 101},
                     {'certificate_number': 'x', 'certificate_id': None},
                     {'certificate_number': 'x', 'certificate_id': 'bad'}]:
            self.assertEqual(self.post('number', data).status_code, 400, data)
        for pk in (foreign.pk, uuid.uuid4()):
            self.assertEqual(self.post('number', {'certificate_number': 'x', 'certificate_id': str(pk)}).status_code, 404)
        for action in ('number', 'detect-numbers'):
            self.assertEqual(self.client.post(f'/api/events/{uuid.uuid4()}/certificates/{action}/', {'certificate_number': ''}, format='json').status_code, 404)
        operator = User.objects.create_user(username='operator', role=User.Role.OPERATOR)
        for user in (None, operator):
            self.client.force_authenticate(user)
            for action in ('number', 'detect-numbers'):
                self.assertIn(self.post(action, {'certificate_number': ''}).status_code, (401, 403))
        superadmin = User.objects.create_user(username='superadmin', role=User.Role.SUPERADMIN)
        self.client.force_authenticate(superadmin)
        for action in ('number', 'detect-numbers'):
            self.assertEqual(self.post(action, {'certificate_number': ''}).status_code, 200)

    def test_empty_event_and_missing_pdf_metadata_can_be_corrected(self):
        empty_url = f'/api/events/{self.other.pk}/certificates/'
        response = self.client.post(empty_url + 'number/', {'certificate_number': '001'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['updated_count'], 0)
        response = self.client.post(empty_url + 'detect-numbers/', {}, format='json')
        self.assertEqual(response.data, {'items': [], 'count': 0})
        cert = self.make_certificate(file=False)
        response = self.post('number', {'certificate_number': '001', 'certificate_id': str(cert.pk)})
        self.assertEqual(response.status_code, 200)
        cert.refresh_from_db()
        self.assertEqual(cert.certificate_number, '001')
        self.assertEqual(cert.status, Certificate.Status.PROCESSING)
        self.assertFalse(cert.pdf_file)

    def test_all_update_is_atomic_on_late_failure(self):
        second = self.make_certificate()
        original_update = QuerySet.update
        def fail_after_update(queryset, **kwargs):
            result = original_update(queryset, **kwargs)
            if 'certificate_number' in kwargs:
                raise RuntimeError('late database failure')
            return result
        with patch.object(QuerySet, 'update', fail_after_update):
            with self.assertRaises(RuntimeError):
                self.post('number', {'certificate_number': '001'})
        for cert in (self.cert, second):
            cert.refresh_from_db()
            self.assertEqual(cert.certificate_number, '')

    def test_detect_final_pdfs_preview_only_and_graceful_failures(self):
        stream = io.BytesIO()
        pdf = canvas.Canvas(stream)
        pdf.drawString(20, 800, 'No: 001/ABC')
        pdf.save()
        self.cert.pdf_file.save('final.pdf', SimpleUploadedFile('final.pdf', stream.getvalue()))
        self.cert.certificate_number = 'manual'
        self.cert.save()
        missing = self.make_certificate(file=False)
        scanned = self.make_certificate()
        blank = io.BytesIO()
        pdf = canvas.Canvas(blank)
        pdf.showPage()
        pdf.save()
        scanned.pdf_file.save('scan.pdf', SimpleUploadedFile('scan.pdf', blank.getvalue()))
        corrupt = self.make_certificate()
        corrupt.pdf_file.save('bad.pdf', SimpleUploadedFile('bad.pdf', b'not a pdf'))
        unavailable = self.make_certificate()
        unavailable.pdf_file.storage.delete(unavailable.pdf_file.name)
        foreign = self.make_certificate(event=self.other)
        original = self.cert.pdf_file.read()
        response = self.client.post(self.url + 'detect-numbers/?page=999&search=none', {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        rows = {row['id']: row for row in response.data['items']}
        self.assertEqual(len(rows), 5)
        self.assertNotIn(str(foreign.pk), rows)
        self.assertEqual(rows[str(self.cert.pk)]['detected_number'], '001/ABC')
        self.assertEqual(rows[str(self.cert.pk)]['certificate_number'], 'manual')
        for cert in (missing, scanned, corrupt, unavailable):
            self.assertEqual(rows[str(cert.pk)]['detected_number'], '')
        self.cert.refresh_from_db()
        self.assertEqual(self.cert.certificate_number, 'manual')
        self.assertEqual(self.cert.pdf_file.read(), original)
        self.assertEqual(self.cert.status, Certificate.Status.PROCESSING)
