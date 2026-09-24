from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.participants.models import Participant


class AttendanceProfileLookupTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.old_event = Event.objects.create(title='Lama', start_date=now, end_date=now + timedelta(hours=1), status='open')
        self.event = Event.objects.create(title='Baru', start_date=now, end_date=now + timedelta(hours=1), status='open')
        self.url = f'/api/public/events/{self.event.public_slug}/participant-lookup/'
        self.client = APIClient()
        self.nik = '1234567890123456'
        self.nip = '123456789012345678'

    def test_reuses_profile_from_previous_event_without_exposing_contact(self):
        Participant.objects.create(event=self.old_event, nik=self.nik, full_name='Nama Tes', institution='Diskominfo', position='Staf', phone='08123456789', email='rahasia@example.com')
        response = self.client.post(self.url, {'nik': self.nik}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Nama Tes')
        self.assertEqual(response.data['institution'], 'Diskominfo')
        self.assertNotIn('phone', response.data)
        self.assertNotIn('email', response.data)

    def test_asn_requires_matching_nip(self):
        Participant.objects.create(event=self.old_event, nik=self.nik, nip=self.nip, is_asn=True, full_name='ASN Tes')
        missing = self.client.post(self.url, {'nik': self.nik}, format='json')
        wrong = self.client.post(self.url, {'nik': self.nik, 'nip': '987654321012345678'}, format='json')
        found = self.client.post(self.url, {'nik': self.nik, 'nip': self.nip}, format='json')
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(missing.data, {'found': False, 'requires_nip': True})
        self.assertEqual(wrong.data, {'found': False, 'requires_nip': True})
        self.assertEqual(found.data['full_name'], 'ASN Tes')
        self.assertNotIn('nip', found.data)

    def test_unknown_and_invalid_nik(self):
        self.assertEqual(self.client.post(self.url, {'nik': self.nik}, format='json').data, {'found': False})
        self.assertEqual(self.client.post(self.url, {'nik': '123'}, format='json').status_code, 400)

    def test_unknown_event_returns_404(self):
        self.assertEqual(self.client.post('/api/public/events/not-a-real-event/participant-lookup/', {'nik': self.nik}, format='json').status_code, 404)
