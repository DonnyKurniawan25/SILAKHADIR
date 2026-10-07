from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.events.models import Event
from .models import Participant

User = get_user_model()


class ParticipantLookupTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            username='staff_test',
            email='staff@example.com',
            password='password123',
            is_staff=True,
            role='admin'
        )
        self.client.force_authenticate(user=self.staff)

        self.event = Event.objects.create(
            title='Lookup Event',
            start_date=timezone.now(),
            end_date=timezone.now()
        )
        self.p1 = Participant.objects.create(
            event=self.event,
            full_name='Bagus Adi Sutistari',
            nik='5204132512970001',
            nip='199712252020121001',
            is_asn=True,
            institution='Diskominfo',
            position='Pranata Komputer',
            phone='08123456789',
            email='bagus@example.com'
        )

    def test_lookup_empty_query(self):
        res = self.client.get(f'/api/events/{self.event.id}/participants/lookup/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['found'])

    def test_lookup_not_found(self):
        res = self.client.get(f'/api/events/{self.event.id}/participants/lookup/?nik=9999999999999999')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['found'])

    def test_lookup_by_nik(self):
        res = self.client.get(f'/api/events/{self.event.id}/participants/lookup/?nik=5204132512970001')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['found'])
        self.assertEqual(res.data['full_name'], 'Bagus Adi Sutistari')
        self.assertEqual(res.data['nip'], '199712252020121001')
        self.assertEqual(res.data['institution'], 'Diskominfo')
        self.assertTrue(res.data['is_asn'])

    def test_lookup_by_nip(self):
        res = self.client.get(f'/api/events/{self.event.id}/participants/lookup/?nip=199712252020121001')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['found'])
        self.assertEqual(res.data['full_name'], 'Bagus Adi Sutistari')
        self.assertEqual(res.data['nik'], '5204132512970001')

    def test_flat_participant_lookup_endpoint(self):
        res = self.client.get('/api/participants/lookup/?nik=5204132512970001')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['found'])
        self.assertEqual(res.data['full_name'], 'Bagus Adi Sutistari')

    def test_pagination_page_size_query_param(self):
        # Create 25 participants
        for i in range(25):
            Participant.objects.create(
                event=self.event,
                full_name=f'Peserta {i}',
                nik=f'520101010101{i:04d}',
                is_asn=False
            )
        # Default page size is 20
        res_default = self.client.get(f'/api/events/{self.event.id}/participants/')
        self.assertEqual(res_default.status_code, 200)
        self.assertEqual(len(res_default.data['results']), 20)

        # Custom page size 50 returns all 26 participants
        res_custom = self.client.get(f'/api/events/{self.event.id}/participants/?page_size=50')
        self.assertEqual(res_custom.status_code, 200)
        self.assertEqual(len(res_custom.data['results']), 26)
