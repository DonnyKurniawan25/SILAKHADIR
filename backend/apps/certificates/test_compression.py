"""Lossless ALL API contract, real qpdf fixtures, isolated test storage."""
import io
import os
import uuid
from pathlib import Path
from unittest.mock import patch
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.test import TestCase
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, DictionaryObject, NumberObject, ArrayObject
from apps.accounts.models import User
from .models import Certificate
from . import test_verification as verification


def fixture(entropy=False, signature=False, escaped=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=842, height=595)
    stream = DecodedStreamObject()
    # Valid content comments, no lossy image pipeline required.
    stream.set_data(b'%' + (os.urandom(1800000).hex().encode() if entropy else b'a' * 2200000) + b'\n')
    page[NameObject('/Contents')] = writer._add_object(stream)
    if signature:
        writer._root_object[NameObject('/Perms')] = DictionaryObject({NameObject('/DocMDP'): writer._add_object(DictionaryObject({NameObject('/Type'): NameObject('/Sig'), NameObject('/ByteRange'): ArrayObject([NumberObject(0), NumberObject(1), NumberObject(2), NumberObject(3)])}))})
    out = io.BytesIO()
    writer.write(out)
    result = out.getvalue()
    if escaped:
        result = result.replace(b'/Perms', b'/Pe#72ms')
    return result


class CompressionTests(TestCase):
    setUp = verification.CertificateVerificationTests.setUp
    make_certificate = verification.CertificateVerificationTests.make_certificate
    post = verification.CertificateVerificationTests.post

    def store(self, cert, data):
        storage = FileSystemStorage(location=cert.pdf_file.storage.location)
        cert.pdf_file.name = storage.save(f'certificates/{self.event.pk}/{uuid.uuid4().hex}.pdf', ContentFile(data))
        cert.save(update_fields=['pdf_file'])
        return cert.pdf_file.name

    def start(self):
        response = self.client.post(self.url + 'compress-all/?page=999&search=no&status=dicabut', {}, format='json')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        return response.data

    def step(self, job):
        return self.post('compress-all/' + job['job_id'])

    def test_snapshot_incremental_deleted_new_and_completed(self):
        second = self.make_certificate(file=False)
        foreign = self.make_certificate(event=self.other)
        job = self.start()
        self.assertEqual((job['total'], job['processed'], job['results']), (2, 0, []))
        deleted_id = str(second.pk)
        second.delete()
        new = self.make_certificate()
        first = self.step(job)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['processed'], 1)
        done = self.step(job)
        self.assertTrue(done.data['done'])
        self.assertEqual(done.data['processed'], 2)
        self.assertEqual({r['id'] for r in done.data['results']}, {str(self.cert.pk), deleted_id})
        self.assertIn('missing', [r['reason'] for r in done.data['results']])
        self.assertEqual(self.step(job).data, done.data)

    def test_real_qpdf_compress_preserves_metadata_and_alias(self):
        data = fixture()
        old = self.store(self.cert, data)
        alias = self.make_certificate(file=False)
        alias.pdf_file.name = old
        alias.save(update_fields=['pdf_file'])
        self.cert.refresh_from_db()
        before = (self.cert.certificate_number, self.cert.status, self.cert.source, self.cert.verification_token, self.cert.download_token, self.cert.qr_code.name)
        job = self.start()
        with self.captureOnCommitCallbacks(execute=True):
            results = self.step(job).data
            results = self.step(job).data
        row = next(r for r in results['results'] if r['id'] == str(self.cert.pk))
        self.assertEqual(row['reason'], 'compressed', row)
        self.assertLess(row['final_bytes'], 1000000)
        self.cert.refresh_from_db()
        self.assertIn('/compressed/', self.cert.pdf_file.name)
        self.assertNotEqual(old, self.cert.pdf_file.name)
        self.assertEqual(before, (self.cert.certificate_number, self.cert.status, self.cert.source, self.cert.verification_token, self.cert.download_token, self.cert.qr_code.name))
        # Alias itself was compressed too, so original has no references now.
        self.assertFalse(self.cert.pdf_file.storage.exists(old))

    def test_signed_and_entropy_unchanged(self):
        for data, expected in [(fixture(signature=True), 'signed'), (fixture(signature=True, escaped=True), 'signed'), (fixture(entropy=True), 'too_large')]:
            old = self.store(self.cert, data)
            response = self.step(self.start())
            self.assertEqual(response.data['results'][0]['reason'], expected, response.data)
            self.cert.refresh_from_db()
            self.assertEqual(self.cert.pdf_file.name, old)
            self.assertEqual(Path(self.cert.pdf_file.path).read_bytes(), data)

    def test_invalid_missing_and_authorization(self):
        for data, expected in [(b'not a PDF', 'unsupported'), (b'%PDF-1.7 invalid', 'unsupported')]:
            self.store(self.cert, data)
            self.assertEqual(self.step(self.start()).data['results'][0]['reason'], expected)
        self.cert.pdf_file.storage.delete(self.cert.pdf_file.name)
        self.assertEqual(self.step(self.start()).data['results'][0]['reason'], 'missing')
        job = self.start()
        self.assertEqual(self.post('compress-all/bad').status_code, 400)
        self.assertEqual(self.client.post(f'/api/events/{self.other.pk}/certificates/compress-all/{job["job_id"]}/', {}, format='json').status_code, 404)
        other = User.objects.create_user(username='other-admin', role=User.Role.ADMIN)
        self.client.force_authenticate(other)
        self.assertEqual(self.step(job).status_code, 404)
        other.role = User.Role.OPERATOR
        other.save()
        self.assertEqual(self.post('compress-all').status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.post('compress-all').status_code, (401, 403))

    def test_busy_does_not_advance(self):
        import fcntl
        from .compression import COMPRESS_LOCK
        job = self.start()
        with open(COMPRESS_LOCK, 'a+b') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(self.step(job).status_code, 409)
        self.assertEqual(self.step(job).data['processed'], 1)

    def test_failed_db_save_removes_new_file_and_rolls_back_progress(self):
        from .models import CertificateCompressionJob
        self.store(self.cert, fixture())
        job = self.start()
        root = Path(self.cert.pdf_file.storage.location)
        before = set(root.rglob('*.pdf'))
        with patch.object(CertificateCompressionJob, 'save', side_effect=RuntimeError('db failure')):
            with self.assertRaises(RuntimeError):
                self.step(job)
        self.assertEqual(set(root.rglob('*.pdf')), before)
        self.assertEqual(CertificateCompressionJob.objects.get(pk=job['job_id']).processed, 0)

    def test_storage_failure_keeps_original_and_counts_error(self):
        from .compression import final_storage
        old = self.store(self.cert, fixture())
        with patch.object(FileSystemStorage, 'save', side_effect=OSError('disk full')):
            response = self.step(self.start())
        self.assertEqual(response.data['results'][0]['reason'], 'error')
        self.cert.refresh_from_db()
        self.assertEqual(self.cert.pdf_file.name, old)
