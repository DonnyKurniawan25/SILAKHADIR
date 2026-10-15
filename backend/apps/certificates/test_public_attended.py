"""Public training history is read-only, including attendance without a certificate."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import Attendance
from apps.events.models import Event
from apps.participants.models import Participant
from .models import Certificate


class PublicAttendedTrainingTests(TestCase):
    url = '/api/public/certificates/check/'
    nik = '5201010101010001'
    nip = '198001012010011001'

    def setUp(self):
        self.client = APIClient()
        self.participants = []
        now = timezone.now()
        for index in range(3):
            event = Event.objects.create(title=f'Pelatihan {index}', start_date=now + timedelta(days=index), end_date=now + timedelta(days=index, hours=1))
            participant = Participant.objects.create(event=event, full_name='Peserta', nik=self.nik, nip=self.nip, email='private@example.com', phone='private')
            Attendance.objects.create(event=event, participant=participant, status='hadir')
            self.participants.append(participant)
        self.cert = Certificate.objects.create(event=self.participants[1].event, participant=self.participants[1], status='diproses')
        Certificate.objects.create(event=self.participants[2].event, participant=self.participants[2], status='dicabut')

    def test_nik_nip_aliases_include_attended_pending_training_without_writes(self):
        before = Certificate.objects.count()
        for params in ({'nik': self.nik}, {'nip': self.nip}, {'identity': self.nip}, {'identity_number': self.nik}, {'nik': self.nip}, {'nik': self.nik, 'nip': self.nip}):
            with self.subTest(params=params):
                response = self.client.get(self.url, params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['count'], 2)
                rows = response.data['results']
                self.assertEqual([row['event_title'] for row in rows], ['Pelatihan 1', 'Pelatihan 0'])
                self.assertEqual(rows[0]['id'], str(self.cert.pk))
                pending = rows[1]
                self.assertEqual(pending['id'], str(self.participants[0].attendances.get().pk))
                self.assertEqual(pending['status'], 'diproses')
                self.assertEqual(pending['certificate_number'], '')
                self.assertIsNone(pending['verify_url'])
                self.assertIsNone(pending['download_url'])
                self.assertFalse(pending['can_download'])
                for field in ('nik', 'nip', 'email', 'phone', 'participant', 'pdf_file', 'download_token', 'verification_token'):
                    self.assertNotIn(field, pending)
        self.assertEqual(Certificate.objects.count(), before)

    def test_filter_and_nip_only_participant(self):
        participant = self.participants[0]
        participant.nik = None
        participant.save()
        response = self.client.get(self.url, {'identity': self.nip, 'event_id': participant.event_id})
        self.assertEqual(response.data.get('count'), 1)
        self.assertEqual(response.data['results'][0]['event_title'], 'Pelatihan 0')
        self.assertFalse(self.client.get(self.url, {'identity': self.nik, 'event_id': participant.event_id}).data['found'])

    def test_registered_absent_and_other_identity_are_not_added(self):
        participant = self.participants[0]
        Attendance.objects.filter(participant=participant).update(status='tidak_hadir')
        self.assertFalse(self.client.get(self.url, {'identity': self.nip, 'event_id': participant.event_id}).data['found'])
        Attendance.objects.filter(participant=participant).delete()
        self.assertFalse(self.client.get(self.url, {'identity': self.nip, 'event_id': participant.event_id}).data['found'])
        self.assertFalse(self.client.get(self.url, {'identity': '0' * 16}).data['found'])
