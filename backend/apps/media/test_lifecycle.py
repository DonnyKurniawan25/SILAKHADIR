"""Real storage / isolated test DB coverage for prospective lifecycle cleanup."""
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.apps import apps
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import FileField
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.events.models import Event
from apps.reports.models import EventReport, EventReportPhoto, EventReportAttachment
from apps.templates_certificate.models import CertificateTemplate
from . import signals


class FileLifecycleTests(TransactionTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lifecycle-')
        self.addCleanup(self.temp.cleanup)
        override = override_settings(MEDIA_ROOT=self.temp.name)
        override.enable()
        self.addCleanup(override.disable)
        signals.register_handlers()
        self.event = Event.objects.create(title='Lifecycle', start_date=timezone.now(), end_date=timezone.now())
        self.storage = Event._meta.get_field('thumbnail').storage

    def upload(self, instance, field, filename='old.png'):
        getattr(instance, field).save(filename, ContentFile(b'file content'))
        return getattr(instance, field).name

    def test_replace_waits_for_commit(self):
        old = self.upload(self.event, 'thumbnail')
        with transaction.atomic():
            new = self.upload(self.event, 'thumbnail', 'new.png')
            self.assertTrue(self.storage.exists(old))
        self.assertFalse(self.storage.exists(old))
        self.assertTrue(self.storage.exists(new))

    def test_clear_waits_for_commit(self):
        old = self.upload(self.event, 'thumbnail')
        with transaction.atomic():
            self.event.thumbnail = ''
            self.event.save(update_fields=['thumbnail'])
            self.assertTrue(self.storage.exists(old))
        self.assertFalse(self.storage.exists(old))

    def test_delete_waits_for_commit(self):
        old = self.upload(self.event, 'thumbnail')
        with transaction.atomic():
            self.event.delete()
            self.assertTrue(self.storage.exists(old))
        self.assertFalse(self.storage.exists(old))

    def test_cascade_queryset_delete_removes_all_report_files(self):
        report = EventReport.objects.create(event=self.event)
        photo = EventReportPhoto.objects.create(report=report)
        attachment = EventReportAttachment.objects.create(report=report, label='File')
        names = [self.upload(self.event, 'thumbnail'), self.upload(report, 'cover_image'),
                 self.upload(photo, 'image'), self.upload(attachment, 'file', 'report.pdf')]
        with transaction.atomic():
            Event.objects.filter(pk=self.event.pk).delete()
            self.assertTrue(all(self.storage.exists(name) for name in names))
        self.assertFalse(any(self.storage.exists(name) for name in names))

    def test_replace_and_delete_rollback_preserve_original(self):
        old = self.upload(self.event, 'thumbnail')
        for action in ('replace', 'delete'):
            with self.subTest(action=action):
                with self.assertRaises(RuntimeError):
                    with transaction.atomic():
                        if action == 'replace':
                            self.upload(self.event, 'thumbnail', 'new.png')
                        else:
                            self.event.delete()
                        raise RuntimeError('rollback')
                self.event = Event.objects.get(thumbnail=old)
                self.assertTrue(self.storage.exists(old))

    def test_inner_savepoint_rollback_discards_cleanup(self):
        old = self.upload(self.event, 'thumbnail')
        with transaction.atomic():
            try:
                with transaction.atomic():
                    self.upload(self.event, 'thumbnail', 'new.png')
                    raise RuntimeError('inner rollback')
            except RuntimeError:
                pass
        self.event.refresh_from_db()
        self.assertEqual(self.event.thumbnail.name, old)
        self.assertTrue(self.storage.exists(old))

    def test_shared_cross_model_reference_and_last_owner(self):
        old = self.upload(self.event, 'thumbnail')
        template = CertificateTemplate.objects.create(name='Shared', background_image=old)
        self.event.delete()
        self.assertTrue(self.storage.exists(old))
        # Ownership is checked for the deleting field: this deliberately unusual
        # cross-field reference is protected, not permitted to delete event paths.
        template.delete()
        self.assertTrue(self.storage.exists(old))

    def test_shared_same_field_last_owner_and_duplicate_callbacks(self):
        old = self.upload(self.event, 'thumbnail')
        other = Event.objects.create(title='Other', start_date=timezone.now(), end_date=timezone.now(), thumbnail=old)
        self.event.delete()
        self.assertTrue(self.storage.exists(old))
        with transaction.atomic():
            self.event = Event.objects.create(title='Again', start_date=timezone.now(), end_date=timezone.now(), thumbnail=old)
            Event.objects.filter(pk__in=[other.pk, self.event.pk]).delete()
        self.assertFalse(self.storage.exists(old))

    def test_update_fields_ignores_unsaved_file_change(self):
        old = self.upload(self.event, 'thumbnail')
        self.event.thumbnail = 'events/thumbnails/unsaved.png'
        self.event.title = 'Changed'
        self.event.save(update_fields=['title'])
        self.event.refresh_from_db()
        self.assertEqual(self.event.thumbnail.name, old)
        self.assertTrue(self.storage.exists(old))

    def test_failed_save_never_schedules_deletion(self):
        old = self.upload(self.event, 'thumbnail')
        self.event.thumbnail = ''
        with patch.object(Event, '_save_table', side_effect=RuntimeError('save failed')):
            with self.assertRaises(RuntimeError):
                self.event.save()
        self.assertTrue(self.storage.exists(old))

    def test_storage_failure_is_logged_without_failing_delete(self):
        old = self.upload(self.event, 'thumbnail')
        with patch.object(self.storage, 'delete', side_effect=OSError('unavailable')):
            with self.assertLogs(signals.__name__, level='ERROR'):
                self.event.delete()
        self.assertFalse(Event.objects.exists())
        self.assertTrue(self.storage.exists(old))

    def test_unsafe_or_unowned_paths_never_reach_storage_delete(self):
        for name in ('/tmp/outside.png', '../outside.png', 'events/../outside.png',
                     'events/thumbnails/../../outside.png', 'https://host/file.png',
                     'branding/unowned.png', 'events/thumbnails/evil\\path.png',
                     'events/thumbnails/<xml>.png'):
            with self.subTest(name=name):
                self.event = Event.objects.create(title='Unsafe', start_date=timezone.now(), end_date=timezone.now(), thumbnail=name)
                with patch.object(self.storage, 'delete') as delete:
                    self.event.delete()
                delete.assert_not_called()

    def test_symlink_escape_is_not_deleted(self):
        with tempfile.TemporaryDirectory(prefix='outside-') as outside:
            target = Path(outside) / 'keep.png'
            target.write_bytes(b'keep')
            directory = Path(self.temp.name) / 'events' / 'thumbnails'
            directory.mkdir(parents=True)
            (directory / 'escape').symlink_to(outside, target_is_directory=True)
            self.event.thumbnail = 'events/thumbnails/escape/keep.png'
            self.event.save()
            self.event.delete()
            self.assertTrue(target.exists())

    def test_registration_covers_all_local_file_models_not_builtins(self):
        signals.register_handlers()  # idempotent
        expected = {model for model in apps.get_models()
                    if model._meta.app_config.name.startswith('apps.')
                    and any(isinstance(field, FileField) for field in model._meta.fields)}
        self.assertEqual(set(signals.register_handlers()), expected)
        for model in expected:
            for field in model._meta.fields:
                if isinstance(field, FileField):
                    with self.subTest(model=model.__name__, field=field.name):
                        self.assertTrue(signals._owned_prefix(field), 'Every current upload callable needs an explicit owned prefix')
