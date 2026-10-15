from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from openpyxl import Workbook

from apps.events.models import Event
from apps.participants.models import Participant
from .models import Attendance


class AttendanceFeedbackTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.admin = users.create_user(username='evaluation-admin', role='admin')
        self.owner = users.create_user(username='evaluation-owner', role='operator')
        self.other = users.create_user(username='evaluation-other', role='operator')
        now = timezone.now()
        self.event = Event.objects.create(title='Evaluasi', start_date=now,
            end_date=now + timedelta(hours=1), status='open', created_by=self.owner)
        self.client = APIClient()
        self.url = f'/api/public/events/{self.event.public_slug}/attendance/'
        self.payload = {'nik': '0123456789012345', 'full_name': 'Peserta',
            'captcha_token': 'test', 'captcha_answer': 'test',
            'feedback': '  Materi baik.\nMohon tambah sesi diskusi.  '}
        self.captcha = patch('apps.attendance.serializers.verify_captcha', return_value=True)
        self.captcha.start()
        self.addCleanup(self.captcha.stop)
        # Exercise field validation, not the shared per-IP public rate limit.
        throttle = patch('apps.attendance.views.PublicAttendanceView.throttle_classes', [])
        throttle.start()
        self.addCleanup(throttle.stop)

    def test_public_feedback_required_nonwhitespace_and_bounded_without_writes(self):
        for value in (None, '', ' \t\n\u2003 ', 'x' * 2001):
            with self.subTest(value=repr(value)[:40]):
                data = dict(self.payload)
                if value is None:
                    data.pop('feedback')
                else:
                    data['feedback'] = value
                response = self.client.post(self.url, data, format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn('feedback', response.data)
                self.assertFalse(Attendance.objects.exists())
                self.assertFalse(Participant.objects.exists())

    def test_public_feedback_persists_trimmed_and_is_event_scoped_not_identity(self):
        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        attendance = Attendance.objects.get(pk=response.data['attendance_id'])
        self.assertEqual(attendance.feedback, self.payload['feedback'].strip())
        self.assertNotIn('feedback', response.data)
        other = Event.objects.create(title='Evaluasi kedua', start_date=self.event.start_date,
            end_date=self.event.end_date, status='open')
        data = {**self.payload, 'feedback': 'Evaluasi berbeda'}
        response = self.client.post(f'/api/public/events/{other.public_slug}/attendance/', data, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Attendance.objects.get(event=other).feedback, 'Evaluasi berbeda')
        attendance.refresh_from_db()
        self.assertEqual(attendance.feedback, self.payload['feedback'].strip())
        duplicate = self.client.post(self.url, data, format='json')
        self.assertEqual(duplicate.status_code, 409)
        attendance.refresh_from_db()
        self.assertEqual(attendance.feedback, self.payload['feedback'].strip())

    def test_admin_import_and_manual_attendance_can_leave_feedback_blank(self):
        participant = Participant.objects.create(event=self.event, nik=self.payload['nik'], full_name='Import')
        attendance = Attendance.objects.create(event=self.event, participant=participant)
        attendance.refresh_from_db()
        self.assertEqual(attendance.feedback, '')
        attendance.full_clean()

    def test_only_admin_or_event_owner_can_read_feedback_in_participant_api(self):
        self.client.post(self.url, self.payload, format='json')
        participant = Participant.objects.get(event=self.event)
        listing = f'/api/events/{self.event.pk}/participants/'
        detail = f'/api/participants/{participant.pk}/'
        self.assertIn(self.client.get(listing).status_code, (401, 403))
        for user, expected in ((self.admin, self.payload['feedback'].strip()),
                               (self.owner, self.payload['feedback'].strip()), (self.other, '')):
            self.client.force_authenticate(user)
            response = self.client.get(listing)
            self.assertEqual(response.status_code, 200)
            rows = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
            self.assertEqual(rows[0]['feedback'], expected)
            response = self.client.get(detail)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['feedback'], expected)

    def test_feedback_not_in_public_lookup_or_event_info_or_admin_identity_lookup(self):
        self.client.post(self.url, self.payload, format='json')
        lookup = self.client.post(f'/api/public/events/{self.event.public_slug}/participant-lookup/',
            {'nik': self.payload['nik']}, format='json')
        self.assertNotIn('feedback', lookup.data)
        info = self.client.get(f'/api/public/events/{self.event.public_slug}/info/')
        self.assertNotIn('feedback', info.data)
        self.client.force_authenticate(self.admin)
        lookup = self.client.get(f'/api/events/{self.event.pk}/participants/lookup/', {'nik': self.payload['nik']})
        self.assertNotIn('feedback', lookup.data)

    def test_feedback_is_read_only_for_participant_edits(self):
        self.client.post(self.url, self.payload, format='json')
        participant = Participant.objects.get(event=self.event)
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f'/api/participants/{participant.pk}/',
            {'feedback': 'Overwrite'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Attendance.objects.get(participant=participant).feedback, self.payload['feedback'].strip())

    def test_public_accepts_maximum_length(self):
        response = self.client.post(self.url, {**self.payload, 'feedback': 'x' * 2000}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(Attendance.objects.get().feedback), 2000)

    def test_xlsx_import_does_not_require_feedback_or_overwrite_evaluation(self):
        self.client.force_authenticate(self.admin)
        def upload():
            workbook = Workbook()
            workbook.active.append(['NIK', 'NIP', 'Nama Lengkap', 'Instansi', 'Jabatan', 'No HP', 'Email', 'Status'])
            workbook.active.append([self.payload['nik'], '', 'Peserta', '', '', '', '', 'hadir'])
            output = BytesIO()
            workbook.save(output)
            return self.client.post(f'/api/events/{self.event.pk}/attendance/import-xlsx/', {
                'file': SimpleUploadedFile('attendance.xlsx', output.getvalue()), 'dry_run': 'false',
            }, format='multipart')
        response = upload()
        self.assertEqual(response.status_code, 200, response.data)
        attendance = Attendance.objects.get(event=self.event)
        self.assertEqual(attendance.feedback, '')
        attendance.feedback = 'Evaluasi yang sudah ada'
        attendance.save(update_fields=['feedback'])
        response = upload()
        self.assertEqual(response.status_code, 200, response.data)
        attendance.refresh_from_db()
        self.assertEqual(attendance.feedback, 'Evaluasi yang sudah ada')
