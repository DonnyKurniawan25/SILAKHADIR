from django.test import TestCase
from . import test_compression as helpers

class CompressionSafetyTests(TestCase):
    setUp = helpers.CompressionTests.setUp
    make_certificate = helpers.CompressionTests.make_certificate
    store = helpers.CompressionTests.store
    start = helpers.CompressionTests.start
    post = helpers.CompressionTests.post

    def test_compressed_path_stays_within_original_filefield_limit(self):
        self.store(self.cert, helpers.fixture())
        job = self.start()
        result = self.post('compress-all/' + job['job_id'])
        self.assertEqual(result.data['results'][0]['reason'], 'compressed', result.data)
        self.cert.refresh_from_db()
        self.assertLessEqual(len(self.cert.pdf_file.name), 100)

    def test_repeated_processed_cursor_does_not_advance_job_twice(self):
        self.make_certificate(file=False)
        job = self.start()
        first = self.post('compress-all/' + job['job_id'], {'processed': 0})
        self.assertEqual(first.data['processed'], 1)
        again = self.post('compress-all/' + job['job_id'], {'processed': 0})
        self.assertEqual(again.data, first.data)
        last = self.post('compress-all/' + job['job_id'], {'processed': 1})
        self.assertTrue(last.data['done'])

    def test_real_image_pixels_and_drawing_stream_remain_identical(self):
        import io
        from pypdf import PdfReader, PdfWriter
        from pypdf.generic import DecodedStreamObject, NameObject, NumberObject, DictionaryObject
        writer = PdfWriter()
        writer.clone_document_from_reader(PdfReader(io.BytesIO(helpers.fixture())))
        page = writer.pages[0]
        image = DecodedStreamObject()
        pixels = b'\x20\x80\xe0' * 1000000
        image.set_data(pixels)
        image.update({NameObject('/Type'): NameObject('/XObject'), NameObject('/Subtype'): NameObject('/Image'),
                      NameObject('/Width'): NumberObject(1000), NameObject('/Height'): NumberObject(1000),
                      NameObject('/ColorSpace'): NameObject('/DeviceRGB'), NameObject('/BitsPerComponent'): NumberObject(8)})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'): DictionaryObject({NameObject('/Im0'): writer._add_object(image)})})
        drawing = page.get_contents().get_data() + b'\nq 100 0 0 100 200 200 cm /Im0 Do Q\n'
        stream = DecodedStreamObject(); stream.set_data(drawing)
        page[NameObject('/Contents')] = writer._add_object(stream)
        data = io.BytesIO(); writer.write(data)
        self.store(self.cert, data.getvalue())
        result = self.post('compress-all/' + self.start()['job_id'])
        self.assertEqual(result.data['results'][0]['reason'], 'compressed', result.data)
        self.cert.refresh_from_db()
        with self.cert.pdf_file.open('rb') as source:
            output = PdfReader(source).pages[0]
            self.assertEqual(output.get_contents().get_data(), drawing)
            self.assertEqual(output['/Resources']['/XObject']['/Im0'].get_object().get_data(), pixels)

    def test_invalid_processed_cursor_is_rejected_without_advance(self):
        job = self.start()
        for cursor in (-1, True, '0', None, 999):
            result = self.post('compress-all/' + job['job_id'], {'processed': cursor})
            self.assertEqual(result.status_code, 400)
        from .models import CertificateCompressionJob
        self.assertEqual(CertificateCompressionJob.objects.get(pk=job['job_id']).processed, 0)

