import io
from datetime import timedelta
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.participants.models import Participant
from apps.certificates.models import Certificate, CertificateDownloadLog
from apps.certificates.serializers import CertificateSerializer
from apps.participants.serializers import ParticipantSerializer


class CertificateDownloadTrackingTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.event = Event.objects.create(
            title='Pelatihan TI',
            start_date=self.now,
            end_date=self.now + timedelta(hours=3),
            status='open',
        )
        self.participant = Participant.objects.create(
            event=self.event,
            full_name='Budi Santoso',
            nik='5201010101010001',
            nip='199001012020011001',
            is_asn=True,
        )
        self.cert = Certificate.objects.create(
            event=self.event,
            participant=self.participant,
            status=Certificate.Status.AVAILABLE,
            certificate_number='001/TI/X/2026',
        )
        stream = io.BytesIO()
        pdf = canvas.Canvas(stream)
        pdf.drawString(100, 100, 'Test Certificate PDF')
        pdf.save()
        self.pdf_bytes = stream.getvalue()
        self.cert.pdf_file.save('cert.pdf', SimpleUploadedFile('cert.pdf', self.pdf_bytes))
        self.client = APIClient()

    def test_initial_download_stats(self):
        self.assertEqual(self.cert.download_count, 0)
        self.assertIsNone(self.cert.last_downloaded_at)
        self.assertEqual(self.cert.download_logs.count(), 0)

    def test_public_download_increments_count_and_creates_log(self):
        url = f'/api/public/certificates/download/{self.cert.download_token}/'
        response = self.client.get(url, HTTP_USER_AGENT='TestAgent/1.0', REMOTE_ADDR='103.108.157.198')
        self.assertEqual(response.status_code, 200)

        self.cert.refresh_from_db()
        self.assertEqual(self.cert.download_count, 1)
        self.assertIsNotNone(self.cert.last_downloaded_at)

        log = self.cert.download_logs.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.ip_address, '103.108.157.198')
        self.assertEqual(log.user_agent, 'TestAgent/1.0')

        # Download kedua kali
        response2 = self.client.get(url, HTTP_USER_AGENT='TestAgent/2.0', REMOTE_ADDR='103.108.157.199')
        self.assertEqual(response2.status_code, 200)

        self.cert.refresh_from_db()
        self.assertEqual(self.cert.download_count, 2)
        self.assertEqual(self.cert.download_logs.count(), 2)

    def test_missing_file_does_not_increment_download_count(self):
        self.cert.pdf_file.storage.delete(self.cert.pdf_file.name)
        url = f'/api/public/certificates/download/{self.cert.download_token}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

        self.cert.refresh_from_db()
        self.assertEqual(self.cert.download_count, 0)
        self.assertIsNone(self.cert.last_downloaded_at)
        self.assertEqual(self.cert.download_logs.count(), 0)

    def test_certificate_serializer_includes_download_info(self):
        self.cert.download_count = 3
        self.cert.last_downloaded_at = self.now
        self.cert.save()

        data = CertificateSerializer(self.cert).data
        self.assertEqual(data['download_count'], 3)
        self.assertIsNotNone(data['last_downloaded_at'])

    def test_participant_serializer_includes_certificate_download_info(self):
        self.cert.download_count = 2
        self.cert.last_downloaded_at = self.now
        self.cert.save()

        data = ParticipantSerializer(self.participant).data
        self.assertEqual(data['certificate_download_count'], 2)
        self.assertIsNotNone(data['certificate_last_downloaded_at'])
