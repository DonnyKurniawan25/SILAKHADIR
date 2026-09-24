import io
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.attendance.models import Attendance
from apps.events.models import Event
from apps.participants.models import Participant
from apps.certificates.models import Certificate
from apps.templates_certificate.models import CertificateTemplate


def image(name='image.png', color='white'):
    buf = io.BytesIO()
    Image.new('RGB', (800, 500), color).save(buf, format='PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


class CertificateWorkflowTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.user = User.objects.create_superuser(username='admin', password='pass', email='a@example.com', role=User.Role.SUPERADMIN)
        self.event = Event.objects.create(title='Kegiatan', start_date=now, end_date=now + timedelta(hours=1), status='open')
        self.participant = Participant.objects.create(event=self.event, nik='1234567890123456', full_name='Peserta')
        Attendance.objects.create(event=self.event, participant=self.participant, status=Attendance.Status.HADIR)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f'/api/events/{self.event.id}/certificates/'

    def test_generate_without_template_creates_processing_without_pdf(self):
        response = self.client.post(self.url + 'generate/', format='json')
        self.assertEqual(response.status_code, 200)
        cert = Certificate.objects.get(event=self.event, participant=self.participant)
        self.assertEqual(cert.status, Certificate.Status.PROCESSING)
        self.assertFalse(cert.pdf_file)
        self.assertEqual(cert.certificate_number, '')

    def test_configure_template_and_shared_number_generates_preview(self):
        response = self.client.post(self.url + 'configure/', {
            'template_image': image(), 'signature_image': image('sig.png'),
            'certificate_number': 'S-001', 'apply_all': 'true',
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.event.refresh_from_db()
        self.assertEqual(self.event.certificate_template.default_certificate_number, 'S-001')
        cert = Certificate.objects.get(event=self.event, participant=self.participant)
        self.assertEqual(cert.certificate_number, 'S-001')
        self.assertEqual(cert.status, Certificate.Status.AVAILABLE)
        self.assertTrue(cert.pdf_file)

    def test_set_number_and_signature_produces_final_without_touching_uploaded_pdf(self):
        template = CertificateTemplate.objects.create(name='T', background_image=image('bg.png'), signature_image=image('sig.png'), default_certificate_number='S-001')
        self.event.certificate_template = template
        self.event.save(update_fields=['certificate_template'])
        self.client.post(self.url + 'generate/', format='json')
        cert = Certificate.objects.get(event=self.event, participant=self.participant)
        self.assertEqual(cert.status, Certificate.Status.AVAILABLE)
        self.assertTrue(cert.pdf_file)

    def test_uploaded_certificate_is_not_regenerated(self):
        template = CertificateTemplate.objects.create(name='T', background_image=image('bg.png'))
        self.event.certificate_template = template
        self.event.save(update_fields=['certificate_template'])
        uploaded = SimpleUploadedFile('signed.pdf', b'%PDF-uploaded', content_type='application/pdf')
        with patch('apps.certificates.views.create_or_update_certificate') as create:
            create.side_effect = lambda **kwargs: Certificate.objects.create(
                event=self.event, participant=self.participant, certificate_number='UP',
                pdf_file=uploaded, source=Certificate.Source.UPLOADED,
                status=Certificate.Status.AVAILABLE)
            self.client.post(self.url + 'upload/', {'participant_id': str(self.participant.id), 'certificate_number': 'UP', 'pdf_file': uploaded}, format='multipart')
        cert = Certificate.objects.get(event=self.event, participant=self.participant)
        old_name = cert.pdf_file.name
        self.client.post(self.url + 'generate/', {'regenerate': 'true'}, format='json')
        cert.refresh_from_db()
        self.assertEqual(cert.pdf_file.name, old_name)
        self.assertEqual(cert.source, Certificate.Source.UPLOADED)

    def test_configure_persists_and_reads_layout(self):
        response = self.client.post(self.url + 'configure/', {
            'template_image': image(), 'signature_image': image('sig.png'),
            'certificate_number': 'S-002', 'name_position_x': '21.5',
            'name_position_y': '42.25', 'signature_width': '19',
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['layout']['name_position_x'], 21.5)
        self.assertEqual(response.data['layout']['name_position_y'], 42.25)
        get_response = self.client.get(self.url + 'configure/')
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.data['certificate_number'], 'S-002')
        self.assertEqual(get_response.data['layout']['name_position_x'], 21.5)
        self.assertTrue(get_response.data['template_image_url'])
        self.assertTrue(get_response.data['signature_image_url'])

    def test_configure_omitted_layout_values_preserve_saved_values(self):
        template = CertificateTemplate.objects.create(
            name='T', background_image=image('bg.png'),
            name_position_x=12.5, name_position_y=33.5,
        )
        self.event.certificate_template = template
        self.event.save(update_fields=['certificate_template'])
        response = self.client.post(self.url + 'configure/', {
            'certificate_number': 'S-003', 'signature_image': image('sig.png'),
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        template.refresh_from_db()
        self.assertEqual(template.name_position_x, 12.5)
        self.assertEqual(template.name_position_y, 33.5)

    def test_suggest_layout_uses_image_analysis_without_persisting(self):
        template = CertificateTemplate.objects.create(
            name='T', background_image=image('bg.png'), name_position_x=11,
        )
        self.event.certificate_template = template
        self.event.save(update_fields=['certificate_template'])
        response = self.client.post(self.url + 'suggest-layout/', format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['method'], 'image-analysis')
        self.assertIn('confidence', response.data)
        self.assertTrue(0 <= response.data['confidence'] <= 1)
        self.assertIn('name_position_x', response.data['layout'])
        self.assertIn('event_position_x', response.data['layout'])
        self.assertIn('date_position_x', response.data['layout'])
        self.assertIn('qr_position_x', response.data['layout'])
        template.refresh_from_db()
        self.assertEqual(template.name_position_x, 11)

    def test_suggest_layout_rejects_invalid_image(self):
        response = self.client.post(self.url + 'suggest-layout/', {
            'template_image': SimpleUploadedFile('bad.png', b'not-an-image', content_type='image/png'),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_certificate_layout_endpoints_require_admin_permission(self):
        operator = User.objects.create_user(username='operator', password='pass', role=User.Role.OPERATOR, nip='123')
        self.client.force_authenticate(operator)
        self.assertEqual(self.client.get(self.url + 'configure/').status_code, 403)
        self.assertEqual(self.client.post(self.url + 'suggest-layout/', format='multipart').status_code, 403)
