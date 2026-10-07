"""Editable review uses fresh global identity and real certificate history."""
from django.test import TestCase
from django.core.files.base import ContentFile
from apps.participants.models import Participant
from apps.participants.serializers import ParticipantSerializer
from apps.certificates.models import Certificate
from .models import Attendance
from . import test_xlsx


class EditedReviewTests(TestCase):
    setUp = test_xlsx.AttendanceXlsxTests.setUp
    upload = test_xlsx.AttendanceXlsxTests.upload

    def row(self, **changes):
        return {'row': 2, **dict(zip(('nik', 'nip', 'full_name', 'institution', 'position', 'phone', 'email', 'status'), test_xlsx.VALID)), **changes}

    def post(self, rows, dry_run=True):
        return self.client.post(self.base + 'import-xlsx/', {'rows': rows, 'dry_run': dry_run}, format='json')

    def known(self, event=None, **changes):
        values = {k: self.row()[k] for k in ('nik', 'nip', 'full_name')}
        return Participant.objects.create(event=event or self.other, **{**values, **changes})

    def test_all_correction_combinations_local_and_cross_event(self):
        for event in (self.event, self.other):
            p = self.known(event)
            for changes, expected in (({'nik': '1123456789012345'}, ['nik']), ({'nip': '112345678901234567'}, ['nip']), ({'nik': '1123456789012345', 'nip': '112345678901234567'}, ['nik', 'nip'])):
                for response in (self.post([self.row(**changes)]), self.upload([[self.row(**changes)[f] for f in ('nik', 'nip', 'full_name', 'institution', 'position', 'phone', 'email', 'status')]])):
                    self.assertEqual(response.status_code, 400, response.data)
                    row = response.data['rows'][0]
                    self.assertEqual(row['system_status'], 'conflict')
                    self.assertEqual(row['correction_fields'], expected)
                    self.assertEqual(row['system_record'], {k: getattr(p, k) for k in ('full_name', 'nik', 'nip')})
                    self.assertEqual({e['column'] for e in response.data['errors']}, {f.upper() for f in expected})
            p.delete()

    def test_correct_edit_remove_duplicate_and_repeat_apply(self):
        self.known()
        bad = self.post([self.row(nik='1123456789012345'), self.row(row=3)])
        self.assertEqual(bad.status_code, 400)
        corrected = self.row(row=3)
        self.assertEqual(self.post([corrected]).status_code, 200)
        for _ in range(2):
            result = self.post([corrected], False)
            self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(Participant.objects.filter(event=self.event).count(), 1)
        self.assertEqual(Attendance.objects.count(), 1)
        self.assertFalse(Certificate.objects.exists())

    def test_green_known_and_new_without_fake_history(self):
        response = self.post([self.row()])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['rows'][0]['system_status'], 'new')
        self.known()
        for response in (self.post([self.row()]), self.upload([test_xlsx.VALID])):
            self.assertEqual(response.status_code, 200)
            row = response.data['rows'][0]
            self.assertEqual(row['system_status'], 'existing')
            self.assertEqual(row['correction_fields'], [])
            self.assertEqual(row['certificate_history'], {'has_certificates': False, 'count': 0, 'events': []})
        self.assertFalse(Certificate.objects.exists())

    def test_actual_history_persists_on_participant_list(self):
        p = self.known()
        cert = Certificate.objects.create(event=self.other, participant=p)
        self.assertFalse(self.post([self.row()]).data['rows'][0]['certificate_history']['has_certificates'])
        cert.pdf_file.save('real.pdf', ContentFile(b'%PDF-1.4\nreal uploaded fixture'))
        self.addCleanup(cert.pdf_file.delete, save=False)
        expected = {'has_certificates': True, 'count': 1, 'events': [{'id': str(self.other.pk), 'title': self.other.title}]}
        result = self.post([self.row()], False)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['rows'][0]['certificate_history'], expected)
        local = Participant.objects.get(event=self.event)
        self.assertEqual(ParticipantSerializer(local).data['certificate_history'], expected)
        response = self.client.get(f'/api/events/{self.event.pk}/participants/')
        self.assertEqual(response.status_code, 200)
        data = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(data[0]['certificate_history'], expected)
        self.assertEqual(Certificate.objects.count(), 1)
        cert.status = Certificate.Status.REVOKED
        cert.save()
        self.assertFalse(ParticipantSerializer(local).data['certificate_history']['has_certificates'])

    def test_metadata_forgery_ignored_and_fresh_database_revalidation(self):
        forged = self.row(participant_id=str(self.known().pk), system_status='existing', correction_fields=[], certificate_history={'has_certificates': True}, _errors=[])
        result = self.post([forged])
        self.assertEqual(result.status_code, 200)
        self.assertIsNone(result.data['rows'][0]['participant_id'])
        self.assertFalse(result.data['rows'][0]['certificate_history']['has_certificates'])
        Participant.objects.filter(event=self.other).update(nik='1123456789012345')
        self.assertEqual(self.post([forged], False).status_code, 400)
        self.assertFalse(Attendance.objects.exists())

    def test_malformed_invalid_and_empty_json_no_writes(self):
        for rows in (None, {}, [], [None], [self.row(row=True)], [self.row(row=0)], [self.row(nik=123)], [self.row(nip='1.98e17')], [self.row(full_name='')], [self.row(institution='=HYPERLINK("evil")')], [self.row(email='bad')], [self.row()] * 5001):
            result = self.post(rows, False)
            self.assertEqual(result.status_code, 400, (rows, result.data))
        self.assertEqual(self.post([self.row()], 'false').status_code, 400)
        self.assertEqual(self.client.post(self.base + 'import-xlsx/', '[', content_type='application/json').status_code, 400)
        self.assertEqual(self.client.post(self.base + 'import-xlsx/', '[]', content_type='application/json').status_code, 400)
        self.assertFalse(Participant.objects.exists())
        self.assertFalse(Attendance.objects.exists())

    def test_null_known_identity_can_be_completed_and_name_only_never_links(self):
        old = self.known(nik=None)
        result = self.post([self.row()], False)
        self.assertEqual(result.status_code, 200, result.data)
        old.refresh_from_db()
        self.assertIsNone(old.nik)
        self.assertEqual(Participant.objects.get(event=self.event).nik, self.row()['nik'])

    def test_cross_event_identifier_name_mismatch_points_exact_name(self):
        self.known(full_name='Other Person')
        response = self.post([self.row()], False)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['rows'][0]['correction_fields'], ['full_name'])
        self.assertEqual(response.data['errors'][0]['column'], 'Nama Lengkap')
        self.assertFalse(Attendance.objects.exists())

    def test_connected_contradiction_detected_when_second_identifier_omitted(self):
        self.known()
        self.known(self.event, nik='1123456789012345', full_name='Different Name')
        response = self.post([self.row(nip='')], False)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['rows'][0]['system_status'], 'ambiguous')

    def test_invalid_identity_never_green_and_json_size_bounded(self):
        self.known()
        for nik in ('1.98e17', 123):
            result = self.post([self.row(nik=nik)])
            self.assertEqual(result.status_code, 400)
            self.assertNotEqual(result.data['rows'][0]['system_status'], 'existing')
        payload = '{"rows":[],"padding":"' + 'x' * (5 * 1024 * 1024) + '"}'
        result = self.client.post(self.base + 'import-xlsx/', payload, content_type='application/json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('5 MB', result.data['errors'][0]['message'])

    def test_missing_pdf_and_processing_never_count_as_history(self):
        p = self.known()
        cert = Certificate.objects.create(event=self.other, participant=p, pdf_file='certificates/not-existing.pdf')
        self.assertFalse(self.post([self.row()]).data['rows'][0]['certificate_history']['has_certificates'])
        cert.pdf_file.save('processing.pdf', ContentFile(b'%PDF-1.4\nfixture'))
        self.addCleanup(cert.pdf_file.delete, save=False)
        cert.status = Certificate.Status.PROCESSING
        cert.save()
        self.assertFalse(self.post([self.row()]).data['rows'][0]['certificate_history']['has_certificates'])

    def test_json_deep_nesting_returns_structured_error(self):
        result = self.client.post(self.base + 'import-xlsx/', '[' * 1500 + ']' * 1500, content_type='application/json')
        self.assertEqual(result.status_code, 400)
        self.assertTrue(result.data['errors'])

    def test_compatible_cross_event_records_both_missing_identifiers_and_history_batch(self):
        self.known()
        local = self.known(self.event, nik=None)
        for changes in ({'nik': None}, {'nip': ''}, {}):
            response = self.post([self.row(**changes)], False)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['rows'][0]['system_status'], 'existing')
            self.assertEqual(response.data['rows'][0]['participant_id'], str(local.pk))
        self.assertEqual(Attendance.objects.count(), 1)
        from apps.participants.identity import IdentityRegistry
        with self.assertNumQueries(2):
            registry = IdentityRegistry()
            for _ in range(20):
                self.assertFalse(registry.participant_history(local)['has_certificates'])

    def test_name_alone_never_links_or_invents_pair(self):
        self.known(nip='')
        response = self.post([self.row(nik=None)], False)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['rows'][0]['system_status'], 'new')
        self.assertIsNone(Participant.objects.get(event=self.event).nik)

    def test_entire_edited_batch_invalid_no_partial_writes(self):
        response = self.post([self.row(), self.row(row=3, nik='1123456789012345', nip='', full_name='Another', email='bad')], False)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Participant.objects.exists())
        self.assertFalse(Attendance.objects.exists())

    def test_ambiguous_global_name_and_conflicting_pairs_no_guesses(self):
        self.known()
        self.known(self.event, nik='1123456789012345', nip='112345678901234567')
        result = self.post([self.row()], False)
        self.assertEqual(result.status_code, 400)
        self.assertEqual(result.data['rows'][0]['system_status'], 'ambiguous')
        self.assertIsNone(result.data['rows'][0]['system_record'])
        self.assertFalse(Attendance.objects.exists())
