import shutil
import tempfile
from io import BytesIO
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase, APIRequestFactory

from .models import Event
from .serializers import EventPublicSerializer, EventSerializer


def image_upload(fmt='PNG', size=(32, 24), name=None):
    stream = BytesIO()
    Image.new('RGB', size, 'green').save(stream, format=fmt)
    return SimpleUploadedFile(name or 'photo.' + fmt.lower(), stream.getvalue(), content_type='image/' + fmt.lower())


class EventThumbnailTests(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp(prefix='event-thumbnail-test-')
        self.addCleanup(shutil.rmtree, self.media)
        self.settings_override = override_settings(MEDIA_ROOT=self.media)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.admin = get_user_model().objects.create_user(username='thumbnail-admin', role='admin')
        self.event = Event.objects.create(title='Kegiatan tanpa foto', start_date=timezone.now(), end_date=timezone.now(), created_by=self.admin)
        self.url = f'/api/events/{self.event.pk}/thumbnail/'
        self.client.force_authenticate(self.admin)

    def test_old_events_serialize_null_and_remain_editable(self):
        request = APIRequestFactory().get('/')
        for serializer in (EventSerializer, EventPublicSerializer):
            self.assertIsNone(serializer(self.event, context={'request': request}).data['thumbnail_url'])
        self.assertEqual(self.client.patch(f'/api/events/{self.event.pk}/', {'title': 'Updated'}).status_code, 200)

    def test_upload_allowed_formats_absolute_url_and_safe_extension(self):
        for fmt in ('PNG', 'JPEG', 'WEBP'):
            with self.subTest(fmt=fmt):
                response = self.client.post(self.url, {'thumbnail': image_upload(fmt, name='misleading.svg')}, format='multipart')
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data['thumbnail_url'].startswith('http://testserver/media/'))
                self.event.refresh_from_db()
                self.assertTrue(self.event.thumbnail.name.endswith({'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp'}[fmt]))
                request = APIRequestFactory().get('/')
                self.assertEqual(EventPublicSerializer(self.event, context={'request': request}).data['thumbnail_url'], response.data['thumbnail_url'])

    def test_superadmin_can_upload(self):
        user = get_user_model().objects.create_user(username='thumbnail-super', role='superadmin')
        self.client.force_authenticate(user)
        self.assertEqual(self.client.post(self.url, {'thumbnail': image_upload()}, format='multipart').status_code, 200)

    def test_operator_even_owner_cannot_upload(self):
        user = get_user_model().objects.create_user(username='thumbnail-operator', role='operator')
        self.event.created_by = user
        self.event.save()
        self.client.force_authenticate(user)
        self.assertEqual(self.client.post(self.url, {'thumbnail': image_upload()}, format='multipart').status_code, 403)

    def test_anonymous_cannot_upload(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.post(self.url, {'thumbnail': image_upload()}, format='multipart').status_code, (401, 403))

    def test_missing_thumbnail_rejected(self):
        self.assertEqual(self.client.post(self.url, {}, format='multipart').status_code, 400)

    def test_svg_corrupt_and_other_image_formats_rejected(self):
        uploads = [SimpleUploadedFile('photo.png', b'<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/png'),
                   SimpleUploadedFile('photo.jpg', b'not an image', 'image/jpeg'), image_upload('GIF')]
        for upload in uploads:
            with self.subTest(name=upload.name):
                self.assertEqual(self.client.post(self.url, {'thumbnail': upload}, format='multipart').status_code, 400)
        self.event.refresh_from_db()
        self.assertFalse(self.event.thumbnail)

    def test_truncated_image_rejected(self):
        upload = image_upload('JPEG')
        damaged = SimpleUploadedFile('photo.jpg', upload.read()[:-20], 'image/jpeg')
        self.assertEqual(self.client.post(self.url, {'thumbnail': damaged}, format='multipart').status_code, 400)

    def test_over_five_mib_rejected(self):
        upload = SimpleUploadedFile('photo.png', b'x' * (5 * 1024 * 1024 + 1), 'image/png')
        self.assertEqual(self.client.post(self.url, {'thumbnail': upload}, format='multipart').status_code, 400)

    def test_dimensions_rejected(self):
        self.assertEqual(self.client.post(self.url, {'thumbnail': image_upload(size=(4097, 1))}, format='multipart').status_code, 400)

    def test_replacement_deletes_previous_file_only_after_commit(self):
        self.client.post(self.url, {'thumbnail': image_upload()}, format='multipart')
        self.event.refresh_from_db()
        storage, previous = self.event.thumbnail.storage, self.event.thumbnail.name
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            response = self.client.post(self.url, {'thumbnail': image_upload('JPEG')}, format='multipart')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(storage.exists(previous))
        self.assertTrue(callbacks)
        self.assertFalse(storage.exists(previous))
        self.event.refresh_from_db()
        self.assertTrue(storage.exists(self.event.thumbnail.name))

    def test_failed_save_preserves_previous_file_and_cleans_new_file(self):
        self.client.post(self.url, {'thumbnail': image_upload()}, format='multipart')
        self.event.refresh_from_db()
        previous = self.event.thumbnail.name
        with patch.object(Event, 'save', side_effect=RuntimeError('save failed')):
            with self.assertRaises(RuntimeError):
                self.client.post(self.url, {'thumbnail': image_upload('JPEG')}, format='multipart')
        self.event.refresh_from_db()
        self.assertEqual(self.event.thumbnail.name, previous)
        storage = self.event.thumbnail.storage
        self.assertTrue(storage.exists(previous))
        self.assertEqual(len(storage.listdir('events/thumbnails')[1]), 1)

    def test_generic_update_cannot_bypass_thumbnail_validation(self):
        response = self.client.patch(f'/api/events/{self.event.pk}/', {'thumbnail': image_upload()}, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.event.refresh_from_db()
        self.assertFalse(self.event.thumbnail)
