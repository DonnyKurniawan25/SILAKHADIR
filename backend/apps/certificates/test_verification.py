import io
import tempfile
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.attendance.models import Attendance
from apps.events.models import Event
from apps.participants.models import Participant
from .models import Certificate
from .views import PublicVerifyCertificateView
from rest_framework.test import APIRequestFactory


class CertificateVerificationTests(TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        settings = override_settings(MEDIA_ROOT=temp.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)
        now = timezone.now()
        self.event = Event.objects.create(title='Verification', start_date=now, end_date=now + timedelta(hours=1))
        self.other = Event.objects.create(title='Other', start_date=now, end_date=now + timedelta(hours=1))
        self.url = f'/api/events/{self.event.pk}/certificates/'
        self.cert = self.make_certificate()

    def make_certificate(self, event=None, attendance='hadir', file=True):
        event = event or self.event
        participant = Participant.objects.create(event=event, full_name='Peserta', nik=uuid.uuid4().hex[:16])
        if attendance:
            Attendance.objects.create(event=event, participant=participant, status=attendance)
        cert = Certificate.objects.create(event=event, participant=participant, status=Certificate.Status.PROCESSING)
        if file:
            stream = io.BytesIO()
            pdf = canvas.Canvas(stream)
            pdf.drawString(10, 10, 'Certificate')
            pdf.save()
            cert.pdf_file.save('certificate.pdf', SimpleUploadedFile('certificate.pdf', stream.getvalue(), content_type='application/pdf'))
        return cert

    def post(self, action, data=None):
        return self.client.post(self.url + action + '/', data if data is not None else {}, format='json')

    def assert_status(self, cert, expected):
        cert.refresh_from_db()
        self.assertEqual(cert.status, expected)

    def test_row_verify_cancel_persists_and_retains_pdf_tokens_and_source(self):
        name = self.cert.pdf_file.name
        with self.cert.pdf_file.open('rb') as stream:
            original = stream.read()
        tokens = (self.cert.verification_token, self.cert.download_token, self.cert.source)
        for action, expected in [('verify', 'tersedia'), ('verify', 'tersedia'), ('cancel-verification', 'diproses'), ('cancel-verification', 'diproses')]:
            response = self.post(f'{self.cert.pk}/{action}')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['updated'], 1)
            self.assertEqual(response.data['certificates'][0]['status'], expected)
            self.assert_status(self.cert, expected)
            self.assertEqual(self.cert.pdf_file.name, name)
            self.assertEqual((self.cert.verification_token, self.cert.download_token, self.cert.source), tokens)
            with self.cert.pdf_file.open('rb') as stream:
                self.assertEqual(stream.read(), original)
            public = PublicVerifyCertificateView.as_view()(APIRequestFactory().get('/'), token=self.cert.verification_token)
            self.assertEqual(public.data['valid'], expected == 'tersedia')

    def test_all_and_subset_ignore_pagination_and_do_not_touch_other_event(self):
        second = self.make_certificate()
        foreign = self.make_certificate(event=self.other)
        response = self.post('verify-all')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated'], 2)
        self.assert_status(self.cert, 'tersedia')
        self.assert_status(second, 'tersedia')
        self.assert_status(foreign, 'diproses')
        response = self.post('cancel-verification-all', {'ids': [str(second.pk)]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assert_status(self.cert, 'tersedia')
        self.assert_status(second, 'diproses')
        response = self.post('cancel-verification-all')
        self.assertEqual(response.data['updated'], 2)
        self.assert_status(self.cert, 'diproses')
        response = self.client.post(self.url + 'verify-all/?search=nobody&page=99', {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated'], 2)

    def test_verify_requires_file_existing_in_storage_and_hadir_in_same_event(self):
        no_file = self.make_certificate(file=False)
        missing_file = self.make_certificate()
        missing_file.pdf_file.storage.delete(missing_file.pdf_file.name)
        absent = self.make_certificate(attendance='tidak_hadir')
        no_attendance = self.make_certificate(attendance=None)
        Attendance.objects.create(event=self.other, participant=no_attendance.participant, status='hadir')
        for cert in (no_file, missing_file, absent, no_attendance):
            with self.subTest(cert=cert.pk):
                response = self.post(f'{cert.pk}/verify')
                self.assertEqual(response.status_code, 400, response.data)
                self.assert_status(cert, 'diproses')
                response = self.post('verify-all', {'ids': [str(self.cert.pk), str(cert.pk)]})
                self.assertEqual(response.status_code, 400, response.data)
                self.assert_status(self.cert, 'diproses')
        self.assertEqual(self.post('verify-all').status_code, 400)
        self.assert_status(self.cert, 'diproses')
        self.assertEqual(self.post('cancel-verification-all').status_code, 200)

    def test_bulk_invalid_or_foreign_ids_never_partially_change_rows(self):
        foreign = self.make_certificate(event=self.other)
        for action in ('verify-all', 'cancel-verification-all'):
            for ids in ([], None, 'all', [123], ['invalid'], [str(self.cert.pk), str(foreign.pk)], [str(self.cert.pk), str(uuid.uuid4())], [str(self.cert.pk), str(self.cert.pk)]):
                with self.subTest(action=action, ids=ids):
                    self.cert.status = 'tersedia' if action.startswith('cancel') else 'diproses'
                    self.cert.save()
                    response = self.post(action, {'ids': ids})
                    self.assertEqual(response.status_code, 400, response.data)
                    self.assert_status(self.cert, 'tersedia' if action.startswith('cancel') else 'diproses')
        self.assertEqual(self.post('verify-all', []).status_code, 400)

    def test_row_foreign_ids_missing_ids_and_missing_events_are_404(self):
        foreign = self.make_certificate(event=self.other)
        for action in ('verify', 'cancel-verification'):
            for pk in (foreign.pk, uuid.uuid4(), 'invalid-uuid'):
                self.assertEqual(self.post(f'{pk}/{action}').status_code, 404)
        missing_url = f'/api/events/{uuid.uuid4()}/certificates/'
        for action in ('verify-all', 'cancel-verification-all'):
            self.assertEqual(self.client.post(missing_url + action + '/', {}, format='json').status_code, 404)
            self.assertEqual(self.client.post(f'/api/events/{self.other.pk}/certificates/{action}/', {}, format='json').status_code, 200)

    def test_auth_scope_all_actions(self):
        actions = (f'{self.cert.pk}/verify', f'{self.cert.pk}/cancel-verification', 'verify-all', 'cancel-verification-all')
        operator = User.objects.create_user(username='operator', role=User.Role.OPERATOR)
        for user in (None, operator):
            self.client.force_authenticate(user)
            for action in actions:
                self.assertIn(self.post(action).status_code, (401, 403))
        superadmin = User.objects.create_user(username='superadmin', role=User.Role.SUPERADMIN)
        self.client.force_authenticate(superadmin)
        for action in actions:
            self.assertEqual(self.post(action).status_code, 200)

    def test_selected_verify_and_transaction_rollback_after_database_update(self):
        second = self.make_certificate()
        response = self.post('verify-all', {'ids': [str(second.pk)]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assert_status(second, 'tersedia')
        self.assert_status(self.cert, 'diproses')
        # A late failure must roll back even after the UPDATE has executed.
        with patch('apps.certificates.views.EventCertificateViewSet.get_serializer', side_effect=RuntimeError('response failed')):
            with self.assertRaises(RuntimeError):
                self.post('verify-all')
        self.assert_status(self.cert, 'diproses')
        self.assert_status(second, 'tersedia')
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual({str(row['id']): row['status'] for row in rows}, {
            str(self.cert.pk): 'diproses', str(second.pk): 'tersedia',
        })

    def test_empty_event_and_storage_failure(self):
        for action in ('verify-all', 'cancel-verification-all'):
            response = self.client.post(f'/api/events/{self.other.pk}/certificates/{action}/', {}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['updated'], 0)
        with patch('django.core.files.storage.FileSystemStorage.exists', side_effect=OSError('unavailable')):
            self.assertEqual(self.post('verify-all').status_code, 400)
        self.assert_status(self.cert, 'diproses')
