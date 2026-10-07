import io
from unittest.mock import patch
from django.test import SimpleTestCase
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from .bounded_detector import DetectionBudget, detect_number, _guard_cmap, UnsafePDF

class CmapBudgetTests(SimpleTestCase):
    def test_subset_maps_and_small_ranges(self):
        self.assertEqual(_guard_cmap(b'2 beginbfchar <00><0041> <01><0042> endbfchar'),2)
        self.assertEqual(_guard_cmap(b'1 beginbfrange <0000><0010><0041> endbfrange'),17)
        self.assertEqual(_guard_cmap(b'1 beginbfrange <00><01>[<0041><0042>] endbfrange'),2)

    def test_compact_expansion_bad_counts_and_long_destinations(self):
        for data in (
            b'1 beginbfrange <0000><ffff><0041> endbfrange',
            b'1 beginbfrange <00000000><ffffffff><0041> endbfrange',
            b'1 beginbfchar <00><0041> <01><0042> endbfchar',
            b'1 beginbfchar <00><'+b'0041'*40+b'> endbfchar',
            b'1 beginbfrange <00><01><0041>',
        ):
            with self.assertRaises(UnsafePDF): _guard_cmap(data)

    def test_font_expansion_is_rejected_before_extract_text(self):
        writer=PdfWriter();page=writer.add_blank_page(100,100)
        cmap=DecodedStreamObject();cmap.set_data(b'1 beginbfrange <0000><ffff><0041> endbfrange')
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/ToUnicode'):writer._add_object(cmap)})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
        out=io.BytesIO();writer.write(out)
        with patch('pypdf._page.PageObject.extract_text') as extract:
            self.assertEqual(detect_number(io.BytesIO(out.getvalue()),DetectionBudget()),'')
            extract.assert_not_called()
