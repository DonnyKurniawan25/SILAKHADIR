import io
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.certificates.models import Certificate
from apps.events.models import Event
from apps.attendance.models import Attendance


class CanvaAttendanceContractTests(TestCase):
    def test_public_attendance_does_not_generate_certificate(self):
        now = timezone.now()
        event = Event.objects.create(title='Absensi Canva', start_date=now,
                                     end_date=now + timedelta(hours=1), status='open')
        with patch('apps.attendance.serializers.verify_captcha', return_value=True):
            response = APIClient().post(f'/api/public/events/{event.public_slug}/attendance/', {
                'nik': '1234567890123456', 'full_name': 'Nama Peserta',
                'captcha_token': 'test', 'captcha_answer': 'test',
            }, format='json')
        self.assertEqual(response.status_code, 201, getattr(response, 'data', None))
        self.assertEqual(Attendance.objects.filter(event=event).count(), 1)
        self.assertFalse(Certificate.objects.filter(event=event).exists())
