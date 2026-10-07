"""Storage contract tests: no database or production media required."""
import os
import random
import tempfile
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile, TemporaryUploadedFile
from django.http import HttpRequest
from django.http.multipartparser import MultiPartParser
from django.test import SimpleTestCase
from django.test.client import encode_multipart
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

from .storage import OptimizedMediaStorage


def noise_image(fmt, alpha=False):
    mode = 'RGBA' if alpha else 'RGB'
    raw = random.Random(19).randbytes(1100 * 1000 * len(mode))
    image = Image.frombytes(mode, (1100, 1000), raw)
    output = BytesIO()
    image.save(output, format=fmt, **({'quality': 100} if fmt != 'PNG' else {}))
    return output.getvalue()


def pdf_bytes(large=False, signed=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=400)
    stream = DecodedStreamObject()
    stream.set_data(b'q\nQ\n' * (350000 if large else 1))
    page[NameObject('/Contents')] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    data = output.getvalue()
    return data + (b'\n% /ByteRange [0 10 20 30]\n' if signed else b'')


class OptimizationTests(SimpleTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='optimization-test-')
        self.addCleanup(self.directory.cleanup)
        self.storage = OptimizedMediaStorage(location=self.directory.name)

    def save_bytes(self, name, data):
        content = ContentFile(data, name=name)
        content.seek(7)
        saved = self.storage.save(name, content)
        self.assertEqual(content.tell(), 7)
        self.assertFalse(content.closed)
        content.seek(0)
        self.assertEqual(content.read(), data)
        with self.storage.open(saved, 'rb') as result:
            return result.read()

    def test_noisy_images_keep_format_dimensions_and_alpha_under_decimal_mb(self):
        for fmt, extension, alpha in [('JPEG', 'jpg', False), ('PNG', 'png', True), ('WEBP', 'webp', True)]:
            with self.subTest(fmt=fmt):
                original = noise_image(fmt, alpha)
                self.assertGreater(len(original), 1000000)
                result = self.save_bytes('noise.' + extension, original)
                self.assertLess(len(result), 1000000)
                with Image.open(BytesIO(result)) as image:
                    image.load()
                    self.assertEqual(image.format, fmt)
                    self.assertLessEqual(image.width, 1100)
                    self.assertLessEqual(image.height, 1000)
                    self.assertGreater(image.width, 100)
                    if alpha:
                        self.assertIn('A', image.getbands())
                        self.assertLess(image.getchannel('A').getextrema()[0], 255)

    def test_small_images_and_pdf_preserved_exactly(self):
        for fmt, extension in [('JPEG', 'jpg'), ('PNG', 'png'), ('WEBP', 'webp')]:
            output = BytesIO()
            Image.new('RGB', (32, 24), 'green').save(output, format=fmt)
            self.assertEqual(self.save_bytes('small.' + extension, output.getvalue()), output.getvalue())
        data = pdf_bytes()
        self.assertEqual(self.save_bytes('small.pdf', data), data)

    def test_signed_pdf_byte_exact_even_when_large(self):
        data = pdf_bytes(large=True, signed=True)
        self.assertGreater(len(data), 1000000)
        self.assertEqual(self.save_bytes('signed.pdf', data), data)

    def test_large_unsigned_pdf_lossless_smaller(self):
        data = pdf_bytes(large=True)
        result = self.save_bytes('document.pdf', data)
        self.assertLess(len(result), len(data))
        before, after = PdfReader(BytesIO(data)), PdfReader(BytesIO(result))
        self.assertEqual(len(before.pages), len(after.pages))
        self.assertEqual(before.pages[0].get_contents().get_data(), after.pages[0].get_contents().get_data())
        self.assertEqual(before.pages[0].mediabox, after.pages[0].mediabox)

    def test_unsupported_invalid_and_mismatched_files_preserved(self):
        for name in ('document.docx', 'sheet.xlsx', 'archive.zip', 'invalid.png', 'invalid.pdf'):
            data = b'PK\x03\x04not really an image' * 60000
            self.assertEqual(self.save_bytes(name, data), data)
        self.assertEqual(self.save_bytes('wrong.jpg', noise_image('PNG')), noise_image('PNG'))

    def test_disk_backed_unsupported_upload_is_not_moved_or_closed(self):
        data = b'original archive bytes' * 100
        upload = TemporaryUploadedFile('archive.zip', 'application/zip', len(data), None)
        self.addCleanup(upload.close)
        upload.write(data)
        upload.seek(9)
        original_path = upload.temporary_file_path()
        saved = self.storage.save(upload.name, upload)
        self.assertTrue(os.path.exists(original_path))
        self.assertFalse(upload.closed)
        self.assertEqual(upload.tell(), 9)
        upload.seek(0)
        self.assertEqual(upload.read(), data)
        with self.storage.open(saved) as result:
            self.assertEqual(result.read(), data)

    def test_exif_orientation_normalized_for_large_image(self):
        source = Image.open(BytesIO(noise_image('JPEG')))
        exif = source.getexif()
        exif[274] = 6
        stream = BytesIO()
        source.save(stream, 'JPEG', quality=100, exif=exif)
        result = self.save_bytes('oriented.jpg', stream.getvalue())
        with Image.open(BytesIO(result)) as image:
            self.assertGreater(image.height, image.width)
            self.assertNotIn(274, image.getexif())
            self.assertLess(len(result), 1000000)

    def test_signature_acroform_is_not_modified(self):
        from pypdf.generic import ArrayObject, DictionaryObject
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=400)
        field = DictionaryObject({NameObject('/FT'): NameObject('/Sig')})
        writer._root_object[NameObject('/AcroForm')] = DictionaryObject({NameObject('/Fields'): ArrayObject([writer._add_object(field)])})
        stream = BytesIO()
        writer.write(stream)
        data = stream.getvalue() + b'\n%' + b'x' * 1000000
        self.assertEqual(self.save_bytes('acroform.pdf', data), data)

    def test_safety_limits_preserve_original(self):
        from django.test import override_settings
        data = noise_image('PNG')
        with override_settings(MEDIA_OPTIMIZATION_MAX_PIXELS=10):
            self.assertEqual(self.save_bytes('limited.png', data), data)
        with override_settings(MEDIA_OPTIMIZATION_MAX_INPUT_BYTES=10):
            self.assertEqual(self.save_bytes('limited-input.png', data), data)

    def test_multipart_formats_retained_and_upload_reusable(self):
        for fmt, extension in [('JPEG', 'jpg'), ('PNG', 'png'), ('WEBP', 'webp')]:
            data = noise_image(fmt)
            upload = SimpleUploadedFile('photo.' + extension, data, content_type='image/' + extension)
            body = encode_multipart('boundary', {'file': upload})
            request = HttpRequest()
            request.META = {'CONTENT_TYPE': 'multipart/form-data; boundary=boundary', 'CONTENT_LENGTH': str(len(body))}
            _, files = MultiPartParser(request.META, BytesIO(body), request.upload_handlers).parse()
            parsed = files['file']
            saved = self.storage.save(parsed.name, parsed)
            self.assertFalse(parsed.closed)
            self.assertEqual(parsed.tell(), 0)
            self.assertEqual(parsed.read(), data)
            with self.storage.open(saved) as stored, Image.open(stored) as image:
                self.assertEqual(image.format, fmt)
                self.assertTrue(saved.endswith('.' + extension))
            self.assertEqual(len(os.listdir(self.directory.name)), ('jpg', 'png', 'webp').index(extension) + 1)
