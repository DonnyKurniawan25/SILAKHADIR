from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class AttendanceFeedbackMigrationTests(TransactionTestCase):
    def test_existing_attendance_survives_with_blank_feedback(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(latest))
        old_target = [node for node in latest if node[0] != 'attendance'] + [('attendance', '0001_initial')]
        executor.migrate(old_target)
        apps = executor.loader.project_state(old_target).apps
        event = apps.get_model('events', 'Event').objects.create(
            title='Existing event', start_date=timezone.now(), end_date=timezone.now())
        participant = apps.get_model('participants', 'Participant').objects.create(
            event=event, nik='0123456789012345', full_name='Existing participant')
        attendance = apps.get_model('attendance', 'Attendance').objects.create(
            event=event, participant=participant, status='hadir')
        executor = MigrationExecutor(connection)
        target = [('attendance', '0002_attendance_feedback')]
        executor.migrate(target)
        new_apps = executor.loader.project_state(target).apps
        stored = new_apps.get_model('attendance', 'Attendance').objects.get(pk=attendance.pk)
        self.assertEqual(stored.feedback, '')
        self.assertEqual(stored.status, 'hadir')
        self.assertEqual(stored.participant_id, participant.pk)
