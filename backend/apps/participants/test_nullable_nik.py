from importlib import import_module

from django.apps import apps
from django.db import connection
from django.test import TestCase
from django.utils import timezone

from apps.events.models import Event
from .models import Participant


class NullableNikTests(TestCase):
    def test_migration_normalizes_only_legacy_empty_nik(self):
        now = timezone.now()
        event = Event.objects.create(title='Nullable NIK', start_date=now, end_date=now)
        blank = Participant.objects.create(event=event, full_name='NIP only', nip='012345678901234567')
        # Simulate a legacy blank written before the migration/model normalizer.
        Participant.objects.filter(pk=blank.pk).update(nik='')
        known = Participant.objects.create(event=event, full_name='Known', nik='0123456789012345')
        migration = import_module('apps.participants.migrations.0003_nullable_nik')
        from types import SimpleNamespace
        migration.normalize_blank_nik(apps, SimpleNamespace(connection=connection))
        blank.refresh_from_db()
        known.refresh_from_db()
        self.assertIsNone(blank.nik)
        self.assertEqual(blank.nip, '012345678901234567')
        self.assertEqual(known.nik, '0123456789012345')
        Participant.objects.create(event=event, full_name='Another NIP only', nip='112345678901234567')
        self.assertEqual(Participant.objects.filter(event=event, nik__isnull=True).count(), 2)
