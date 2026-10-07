"""Additional identity-enrichment regression: collisions must be user errors."""
import io
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from openpyxl import Workbook
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.events.models import Event
from apps.participants.models import Participant
from apps.attendance.models import Attendance

class EnrichedIdentityCollisionTests(TestCase):
    def setUp(self):
        self.admin=User.objects.create_user(username='identity-review-admin',role='admin')
        self.client=APIClient();self.client.force_authenticate(self.admin)
        defaults={'created_by':self.admin,'start_date':timezone.now(),'end_date':timezone.now()+timedelta(hours=1)}
        self.reference=Event.objects.create(title='Known identity',**defaults)
        self.target=Event.objects.create(title='Import target',**defaults)
        Participant.objects.create(event=self.reference,full_name='ASN Dikenal',nik='0123456789012345',nip='198001012010011001',is_asn=True)
    def test_enriched_nik_collision_is_400_not_integrity_error(self):
        wb=Workbook();ws=wb.active;ws.title='Absensi';ws.append(['NIK','NIP','Nama Lengkap','Instansi','Jabatan','No HP','Email','Status'])
        ws.append(['','198001012010011001','ASN Dikenal','','','','',''])
        ws.append(['0123456789012345','','Nama Berbeda','','','','',''])
        data=io.BytesIO();wb.save(data)
        from django.core.files.uploadedfile import SimpleUploadedFile
        for dry_run in ('true','false'):
            upload=SimpleUploadedFile('collision.xlsx',data.getvalue())
            response=self.client.post(f'/api/events/{self.target.pk}/attendance/import-xlsx/',{'file':upload,'dry_run':dry_run},format='multipart')
            self.assertEqual(response.status_code,400,response.data)
            self.assertTrue(response.data['errors'])
        self.assertEqual(self.target.participants.count(),0)
        self.assertEqual(Attendance.objects.filter(event=self.target).count(),0)

    def test_numeric_nip_has_one_actionable_error_not_three(self):
        wb=Workbook();ws=wb.active;ws.title='Absensi';ws.append(['NIK','NIP','Nama Lengkap','Instansi','Jabatan','No HP','Email','Status'])
        ws.append(['', 1.98001012010011e17, 'ASN Angka Ilmiah', '', '', '', '', ''])
        data=io.BytesIO();wb.save(data)
        from django.core.files.uploadedfile import SimpleUploadedFile
        response=self.client.post(f'/api/events/{self.target.pk}/attendance/import-xlsx/',{'file':SimpleUploadedFile('number.xlsx',data.getvalue()),'dry_run':'true'},format='multipart')
        self.assertEqual(response.status_code,400)
        nip_errors=[issue for issue in response.data['errors'] if issue['column']=='NIP']
        self.assertEqual(len(nip_errors),1)
        self.assertIn('sumber asli',nip_errors[0]['hint'])
