from django.test import TestCase
from apps.participants.models import Participant
from .models import Attendance
from . import test_xlsx

VALID = test_xlsx.VALID


class AttendanceIdentityTests(TestCase):
    setUp = test_xlsx.AttendanceXlsxTests.setUp
    upload = test_xlsx.AttendanceXlsxTests.upload

    def row(self, nik='', nip=VALID[1], name=VALID[2], phone=''):
        return [nik, nip, name, '', '', phone, '', '']

    def test_multiple_nip_only_repeat_and_later_nik_same_attendance(self):
        rows = [self.row(), self.row(nip='112345678901234567', name='Second')]
        for _ in range(2):
            response = self.upload(rows, 'false')
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Participant.objects.count(), 2)
        self.assertEqual(Participant.objects.filter(nik__isnull=True).count(), 2)
        p = Participant.objects.get(nip=VALID[1])
        attendance = Attendance.objects.get(participant=p)
        self.assertEqual(attendance.status, 'hadir')
        self.assertEqual(self.upload([self.row(nik=VALID[0])], 'false').status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.nik, VALID[0])
        self.assertEqual(Attendance.objects.get(participant=p).pk, attendance.pk)
        self.assertEqual(self.upload([self.row()], 'false').status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.nik, VALID[0])

    def test_cross_event_reuse_only_exact_compatible_nip(self):
        Participant.objects.create(event=self.other, nik=VALID[0], nip=VALID[1], full_name=VALID[2])
        response = self.upload([self.row()], 'false')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Participant.objects.get(event=self.event).nik, VALID[0])

    def test_cross_event_conflict_and_name_mismatch_rejected(self):
        Participant.objects.create(event=self.other, nik=VALID[0], nip=VALID[1], full_name='Wrong')
        self.assertEqual(self.upload([self.row()], 'false').status_code, 400)

    def test_name_alone_never_reuses_nik(self):
        Participant.objects.create(event=self.other, nik=VALID[0], full_name=VALID[2])
        self.assertEqual(self.upload([self.row()], 'false').status_code, 200)
        self.assertIsNone(Participant.objects.get(event=self.event).nik)

    def test_conflicting_supplied_identifiers_and_duplicate_nip(self):
        Participant.objects.create(event=self.event, nik=VALID[0], full_name=VALID[2])
        Participant.objects.create(event=self.event, nik='1123456789012345', nip=VALID[1], full_name='Second')
        self.assertEqual(self.upload([self.row(nik=VALID[0])], 'false').status_code, 400)
        self.assertEqual(self.upload([self.row(name='Third'), self.row(name='Fourth')]).status_code, 400)

    def test_dash_optional_nik_only_and_numeric_phone(self):
        response = self.upload([self.row(nik=VALID[0], nip='—', phone=8123456789)], 'false')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Participant.objects.get().phone, '8123456789')
        self.assertFalse(Participant.objects.get().is_asn)

    def test_numeric_identity_actionable_column_errors(self):
        for field, column in [('nik', 'NIK'), ('nip', 'NIP')]:
            response = self.upload([self.row(**{field: 1.98e17})])
            self.assertEqual(response.status_code, 400)
            error = next(e for e in response.data['errors'] if e.get('column') == column)
            self.assertIn('format angka ilmiah/digit mungkin berubah', error['message'])
            self.assertIn('sumber asli', error['hint'])

    def test_ambiguous_existing_nip_and_cross_event_niks_rejected(self):
        for nik in (VALID[0], '1123456789012345'):
            Participant.objects.create(event=self.other, nik=nik, nip=VALID[1], full_name=VALID[2])
        self.assertEqual(self.upload([self.row()]).status_code, 400)

    def test_recovered_nik_conflicts_with_another_import_row(self):
        Participant.objects.create(event=self.other, nik=VALID[0], nip=VALID[1], full_name=VALID[2])
        response = self.upload([self.row(), self.row(nik=VALID[0], nip='', name='Different')])
        self.assertEqual(response.status_code, 400, response.data)
        self.assertTrue(any(e['row'] == 3 and e['column'] == 'NIK' for e in response.data['errors']))

    def test_same_event_duplicate_nip_is_ambiguous(self):
        for nik in (None, VALID[0]):
            Participant.objects.create(event=self.event, nik=nik, nip=VALID[1], full_name=VALID[2])
        response = self.upload([self.row()], 'false')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(any(e['column'] == 'NIP' for e in response.data['errors']))
        self.assertFalse(Attendance.objects.exists())

    def test_cross_event_nik_can_upgrade_local_nip_only(self):
        local = Participant.objects.create(event=self.event, nip=VALID[1], full_name=VALID[2])
        Attendance.objects.create(event=self.event, participant=local)
        Participant.objects.create(event=self.other, nik=VALID[0], nip=VALID[1], full_name=VALID[2])
        response = self.upload([self.row()], 'false')
        self.assertEqual(response.status_code, 200, response.data)
        local.refresh_from_db()
        self.assertEqual(local.nik, VALID[0])
        self.assertEqual(Participant.objects.filter(event=self.event).count(), 1)
        self.assertEqual(response.data['updated'], 1)

    def test_phone_integral_float_safe_but_unsafe_numeric_rejected(self):
        response = self.upload([self.row(phone=8123456789.0)], 'false')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Participant.objects.get().phone, '8123456789')
        for phone in (123.5, 10 ** 15, -123):
            self.assertEqual(self.upload([self.row(phone=phone)]).status_code, 400)

    def test_model_normalizes_empty_nik_to_null(self):
        p = Participant.objects.create(event=self.event, nik='', nip=VALID[1], full_name=VALID[2])
        p.refresh_from_db()
        self.assertIsNone(p.nik)

    def test_participant_serializer_still_requires_nik(self):
        from apps.participants.serializers import ParticipantSerializer
        for value in ({}, {'nik': None}, {'nik': ''}):
            serializer = ParticipantSerializer(data={'full_name': VALID[2], **value})
            self.assertFalse(serializer.is_valid())
            self.assertIn('nik', serializer.errors)

    def test_template_documents_identity_rules_and_two_text_examples(self):
        from io import BytesIO
        from openpyxl import load_workbook
        wb = load_workbook(BytesIO(self.client.get(self.base + 'template-xlsx/').content))
        text = ' '.join(str(r[0]) for r in wb['Petunjuk'].values)
        self.assertIn('minimal satu', text)
        self.assertIn('kosong', text)
        examples = list(wb['Contoh'].values)[1:]
        self.assertTrue(any(not r[0] and r[1] for r in examples))
        self.assertTrue(any(r[0] and not r[1] for r in examples))

    def test_missing_identity_or_name_rejected(self):
        for row in (self.row(nip='-'), self.row(name='')):
            self.assertEqual(self.upload([row], 'false').status_code, 400)
        self.assertFalse(Participant.objects.exists())
