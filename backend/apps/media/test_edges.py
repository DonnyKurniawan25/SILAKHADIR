import io,random,tempfile
from unittest.mock import patch
from PIL import Image
from django.test import TestCase, override_settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.utils import timezone
from apps.events.models import Event
from apps.reports.models import EventReport,EventReportPhoto
from apps.media.storage import OptimizedMediaStorage

class MediaEdgeTests(TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.override=override_settings(MEDIA_ROOT=self.tmp.name);self.override.enable();self.addCleanup(self.override.disable)
    def optimize(self,img):
        out=io.BytesIO();img.save(out,format='PNG');raw=out.getvalue();self.assertGreater(len(raw),1_000_000)
        storage=OptimizedMediaStorage(location=self.tmp.name);name=storage.save('edge.png',ContentFile(raw))
        with storage.open(name,'rb') as f: result=f.read()
        self.assertLess(len(result),1_000_000);Image.open(io.BytesIO(result)).verify()
    def test_wide_banner_png_below_target(self):
        self.optimize(Image.frombytes('RGB',(4096,128),random.Random(44).randbytes(4096*128*3)))
    def test_largest_permitted_thumbnail_below_target(self):
        img=Image.new('RGB',(4096,4096),'white');noise=Image.frombytes('RGB',(640,640),random.Random(2).randbytes(640*640*3));img.paste(noise,(20,20));self.optimize(img)
    def test_combined_digital_signature_marker_requires_separate_upload(self):
        from reportlab.pdfgen import canvas
        from django.contrib.auth import get_user_model
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.exceptions import ValidationError
        from apps.certificates.imports import create_preview
        event=Event.objects.create(title='QA signed source',start_date=timezone.now(),end_date=timezone.now())
        owner=get_user_model().objects.create_user(username='signed-source-qa')
        stream=io.BytesIO();c=canvas.Canvas(stream);c.drawString(20,700,'QA signature guard');c.save()
        content=stream.getvalue()+b'\n% /ByteRange [0 1 2 3]\n'
        with self.assertRaisesMessage(ValidationError,'terpisah'):
            create_preview(event,owner,[SimpleUploadedFile('signed.pdf',content)],{'mode':'combined'})

    def test_pdf_over_decoded_stream_budget_is_preserved(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, NameObject
        from apps.media.optimization import optimize_bytes
        writer=PdfWriter();page=writer.add_blank_page(width=600,height=400)
        stream=DecodedStreamObject();stream.set_data(b'%'+b'a'*9_000_000+b'\n')
        page[NameObject('/Contents')]=writer._add_object(stream)
        output=io.BytesIO();writer.write(output);original=output.getvalue()
        self.assertTrue(optimize_bytes('budget.pdf',original)==original)

    def test_same_filesystem_storage_alias_retains_shared_reference(self):
        event=Event.objects.create(title='QA alias',start_date=timezone.now(),end_date=timezone.now())
        event.thumbnail.save('alias.png',ContentFile(b'owned test file'));name=event.thumbnail.name;storage=event.thumbnail.storage
        report=EventReport.objects.create(event=event)
        field=EventReportPhoto._meta.get_field('image')
        with patch.object(field,'storage',FileSystemStorage(location=self.tmp.name)):
            EventReportPhoto.objects.create(report=report,image=name)
            with self.captureOnCommitCallbacks(execute=True):
                event.thumbnail=None;event.save(update_fields=['thumbnail'])
            self.assertTrue(storage.exists(name))
