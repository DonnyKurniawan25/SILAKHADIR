import io
import zlib
from unittest.mock import patch
from django.test import SimpleTestCase
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from reportlab.pdfgen import canvas
from PIL import Image
from reportlab.lib.utils import ImageReader
from .bounded_detector import DetectionBudget, detect_number


def fixture(pages=1, logo=False, form=False):
    out = io.BytesIO()
    pdf = canvas.Canvas(out)
    if form:
        pdf.beginForm('number')
        pdf.drawString(20, 700, 'No: 001/ABC')
        pdf.endForm()
    for _ in range(pages):
        if logo:
            pdf.drawImage(ImageReader(Image.new('RGB', (2, 2), 'red')), 20, 720, 10, 10)
        if form:
            pdf.doForm('number')
        else:
            pdf.drawString(20, 700, 'No: 001/ABC')
        pdf.showPage()
    pdf.save()
    return out.getvalue()


class BoundedDetectorTests(SimpleTestCase):
    def test_plain_logo_form_and_caller_source_preserved(self):
        for kwargs in ({}, {'logo': True}, {'form': True}):
            data = fixture(**kwargs)
            source = io.BytesIO(data)
            self.assertEqual(detect_number(source, DetectionBudget()), '001/ABC')
            self.assertFalse(source.closed)
            self.assertEqual(source.getvalue(), data)

    def test_bounded_read_and_pages(self):
        class ReadSpy(io.BytesIO):
            def read(self, size=-1):
                self.assert_read = size
                if size < 0:
                    raise AssertionError('unbounded read')
                return super().read(size)
        source = ReadSpy(fixture())
        with patch('apps.certificates.bounded_detector.MAX_RAW_BYTES', 100):
            self.assertEqual(detect_number(source, DetectionBudget()), '')
        self.assertEqual(source.assert_read, 101)
        self.assertEqual(detect_number(io.BytesIO(fixture(pages=11)), DetectionBudget()), '')

    def test_content_font_and_form_decoded_budget(self):
        for kind in ('content', 'font', 'form'):
            writer = PdfWriter()
            page = writer.add_blank_page(100, 100)
            stream = DecodedStreamObject()
            stream.set_data(b'x' * 2000)
            stream = stream.flate_encode()
            resources = DictionaryObject()
            page[NameObject('/Resources')] = resources
            if kind == 'content':
                page[NameObject('/Contents')] = writer._add_object(stream)
            elif kind == 'font':
                font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/ToUnicode'): writer._add_object(stream)})
                resources[NameObject('/Font')] = DictionaryObject({NameObject('/F1'): writer._add_object(font)})
            else:
                stream[NameObject('/Subtype')] = NameObject('/Form')
                resources[NameObject('/XObject')] = DictionaryObject({NameObject('/F1'): writer._add_object(stream)})
            out = io.BytesIO()
            writer.write(out)
            with patch('apps.certificates.bounded_detector.MAX_DECODED_BYTES', 100):
                with patch('pypdf._page.PageObject.extract_text') as extract:
                    self.assertEqual(detect_number(io.BytesIO(out.getvalue()), DetectionBudget()), '')
                    extract.assert_not_called()

    def test_recursive_form_unsafe_filter_and_text_limit(self):
        writer = PdfWriter()
        page = writer.add_blank_page(100, 100)
        form = DecodedStreamObject()
        form.set_data(b'/Self Do')
        form[NameObject('/Subtype')] = NameObject('/Form')
        ref = writer._add_object(form)
        resources = DictionaryObject({NameObject('/XObject'): DictionaryObject({NameObject('/Self'): ref})})
        form[NameObject('/Resources')] = resources
        page[NameObject('/Resources')] = resources
        out = io.BytesIO()
        writer.write(out)
        with patch('pypdf._page.PageObject.extract_text') as extract:
            self.assertEqual(detect_number(io.BytesIO(out.getvalue()), DetectionBudget()), '')
            extract.assert_not_called()
        form[NameObject('/Filter')] = NameObject('/LZWDecode')
        out = io.BytesIO()
        writer.write(out)
        self.assertEqual(detect_number(io.BytesIO(out.getvalue()), DetectionBudget()), '')
        with patch('apps.certificates.bounded_detector.MAX_TEXT_CHARS', 2):
            self.assertEqual(detect_number(io.BytesIO(fixture()), DetectionBudget()), '')

    def test_aggregate_file_raw_decoded_and_time_stop_before_parser(self):
        data = fixture()
        for kwargs in ({'max_files': 0}, {'max_raw': 10}, {'max_decoded': 1}, {'max_seconds': 0}):
            budget = DetectionBudget(**kwargs)
            self.assertEqual(detect_number(io.BytesIO(data), budget), '')
            with patch('apps.certificates.bounded_detector.PdfReader') as reader:
                self.assertEqual(detect_number(io.BytesIO(data), budget), '')
                reader.assert_not_called()
