"""Parent integration assertions for editable review and cross-event certificate history."""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.events.models import Event
from apps.participants.models import Participant
from apps.attendance.models import Attendance
from apps.certificates.models import Certificate

class ReviewParentContractTests(TestCase):
    def setUp(self):
        self.admin=User.objects.create_user(username='review-contract-admin',role='admin')
        self.client=APIClient();self.client.force_authenticate(self.admin)
        args={'created_by':self.admin,'start_date':timezone.now(),'end_date':timezone.now()+timedelta(hours=1)}
        self.past=Event.objects.create(title='Past event',**args)
        self.target=Event.objects.create(title='Target event',**args)
        self.known=Participant.objects.create(event=self.past,full_name='Known ASN',nik='0123456789012345',nip='198001012010011001',is_asn=True)
        self.path=f'/api/events/{self.target.pk}/attendance/import-xlsx/'
    def row(self,**updates):
        result={'row':2,'full_name':'Known ASN','nik':'0123456789012345','nip':'198001012010011001','institution':'','position':'','phone':'','email':'','status':'hadir'}
        return {**result,**updates}
    def post(self,rows,dry=True):return self.client.post(self.path,{'rows':rows,'dry_run':dry},format='json')
    def test_corrections_then_apply_preserves_history_after_reopen(self):
        from django.core.files.base import ContentFile
        import io
        from pypdf import PdfWriter
        out=io.BytesIO();pdf=PdfWriter();pdf.add_blank_page(width=600,height=400);pdf.write(out)
        cert=Certificate.objects.create(event=self.past,participant=self.known,source='uploaded',status='tersedia')
        cert.pdf_file.save('qa-history.pdf',ContentFile(out.getvalue()))
        for wrong,fields in [({'nik':'0123456789012346'},{'nik'}),({'nip':'198001012010011002'},{'nip'}),({'nik':'0123456789012346','nip':'198001012010011002'},{'nik','nip'})]:
            response=self.post([self.row(**wrong)])
            self.assertEqual(response.status_code,400,response.data)
            row=response.data['rows'][0]
            self.assertEqual(row['system_status'],'conflict')
            self.assertEqual(set(row['correction_fields']),fields)
        clean=self.post([self.row()]);self.assertEqual(clean.status_code,200,clean.data)
        self.assertEqual(clean.data['rows'][0]['system_status'],'existing')
        self.assertTrue(clean.data['rows'][0]['certificate_history']['has_certificates'])
        self.assertFalse(self.target.participants.exists())
        saved=self.post([self.row()],False);self.assertEqual(saved.status_code,200,saved.data)
        again=self.post([self.row()],False);self.assertEqual(again.status_code,200,again.data)
        self.assertEqual(self.target.participants.count(),1)
        self.assertEqual(Attendance.objects.filter(event=self.target).count(),1)
        self.assertFalse(Certificate.objects.filter(event=self.target).exists())
        listing=self.client.get(f'/api/events/{self.target.pk}/participants/')
        self.assertEqual(listing.status_code,200)
        data=listing.data['results'] if isinstance(listing.data,dict) else listing.data
        self.assertTrue(data[0]['certificate_history']['has_certificates'])
        self.assertEqual(data[0]['certificate_history']['count'],1)
    def test_remove_duplicate_then_json_import_works(self):
        row=self.row(full_name='New ASN',nik='',nip='198001012010011002')
        duplicate=self.post([row,{**row,'row':3}]);self.assertEqual(duplicate.status_code,400)
        removed=self.post([row],False);self.assertEqual(removed.status_code,200,removed.data)
        self.assertEqual(self.target.participants.count(),1)
        self.assertIsNone(self.target.participants.get().nik)
