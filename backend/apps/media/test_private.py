import tempfile
from pathlib import Path
from django.test import TestCase, override_settings
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from apps.events.models import Event
from apps.certificates.models import CertificateImportBatch, CertificateImportItem
from apps.certificates.imports import private_storage

class PrivateLifecycleTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.settings = override_settings(CERTIFICATE_IMPORT_ROOT=self.temp.name); self.settings.enable(); self.addCleanup(self.settings.disable)
        self.owner = get_user_model().objects.create_user(username='private-file-qa')
        self.event = Event.objects.create(title='QA Private files', start_date=timezone.now(),end_date=timezone.now())
        self.batch = CertificateImportBatch.objects.create(event=self.event,owner=self.owner,snapshot='qa',expires_at=timezone.now())
        self.name = str(self.batch.pk)+'/test.pdf'
        from django.core.files.base import ContentFile
        private_storage().save(self.name,ContentFile(b'%PDF-1.4 QA'))
        self.item = CertificateImportItem.objects.create(batch=self.batch, private_path=self.name,page_start=1,page_end=1)
    def test_item_delete_removes_private_file_after_commit(self):
        with self.captureOnCommitCallbacks(execute=True): self.item.delete()
        self.assertFalse(private_storage().exists(self.name))
    def test_event_delete_cleans_private_preview_cascade(self):
        with self.captureOnCommitCallbacks(execute=True): self.event.delete()
        self.assertFalse(private_storage().exists(self.name))
    def test_rollback_keeps_preview(self):
        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    self.item.delete(); raise ValueError('rollback')
            except ValueError: pass
        self.assertTrue(private_storage().exists(self.name))
    def test_shared_private_path_is_preserved(self):
        CertificateImportItem.objects.create(batch=self.batch,private_path=self.name,page_start=2,page_end=2)
        with self.captureOnCommitCallbacks(execute=True): self.item.delete()
        self.assertTrue(private_storage().exists(self.name))
