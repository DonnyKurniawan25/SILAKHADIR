"""Strict, bounded XLSX attendance interchange. No certificate side effects."""
from collections import defaultdict
from io import BytesIO
import re
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from django.core.exceptions import ValidationError
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils.exceptions import InvalidFileException
from openpyxl.utils import column_index_from_string
from openpyxl.worksheet.datavalidation import DataValidation

from apps.participants.models import Participant
from .models import Attendance

HEADERS = ('NIK', 'NIP', 'Nama Lengkap', 'Instansi', 'Jabatan', 'No HP', 'Email', 'Status')
FIELDS = ('nik', 'nip', 'full_name', 'institution', 'position', 'phone', 'email', 'status')
MAX_BYTES = 5 * 1024 * 1024
MAX_EXPANDED_BYTES = 25 * 1024 * 1024
MAX_ROWS = 5000
MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


class XlsxError(ValueError):
    pass


def _text_cell(cell, value):
    # Explicit string type (not apostrophe escaping): even =,+,-,@ remain inert
    # text in Excel, without changing the exported user's actual value.
    cell.value = str(value or '')
    cell.data_type = 's'
    cell.number_format = '@'
    cell.font = Font(name='Arial', size=11)


def _sheet(wb, name, rows):
    ws = wb.create_sheet(name)
    ws.append(HEADERS)
    for cell in ws[1]:
        cell.font = Font(name='Arial', bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='245A81')
    for values in rows:
        index = ws.max_row + 1
        for col, value in enumerate(values, 1):
            _text_cell(ws.cell(index, col), value)
    for col, width in zip('ABCDEFGH', (22, 24, 32, 32, 26, 22, 32, 20)):
        ws.column_dimensions[col].width = width
        ws.column_dimensions[col].number_format = '@'
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions
    return ws


def workbook_bytes(event, template=False):
    wb = Workbook()
    wb.remove(wb.active)
    rows = [] if template else (
        [*(getattr(a.participant, f) for f in FIELDS[:-1]), a.status]
        for a in Attendance.objects.filter(event=event).select_related('participant').order_by('participant__full_name', 'participant__nik')
    )
    ws = _sheet(wb, 'Absensi', rows)
    if template:
        status = DataValidation(type='list', formula1='"hadir,tidak_hadir"')
        status.errorTitle = 'Status tidak valid'
        status.error = 'Pilih hadir atau tidak_hadir.'
        status.showErrorMessage = True
        ws.add_data_validation(status)
        status.add(f'H2:H{MAX_ROWS + 1}')
        instructions = wb.create_sheet('Petunjuk')
        for text in (
            'Isi hanya sheet Absensi; sheet Contoh tidak diimpor.',
            'Jangan ubah nama/urutan delapan kolom pada baris pertama.',
            'Nama Lengkap wajib dan minimal satu identitas: ASN dengan NIP 18 digit boleh tanpa NIK; tanpa NIP wajib NIK 16 digit.',
            'Simpan NIK dan NIP sebagai Text sebelum tempel dari sumber asli; angka ilmiah/digit yang berubah tidak dapat dipulihkan.',
            'Instansi, Jabatan, No HP dan Email opsional. Status kosong menjadi hadir; pilihan hadir atau tidak_hadir.',
            'NIK/NIP kosong, - atau — dianggap tidak diisi. NIK hanya digunakan ulang dari NIP persis dengan nama cocok dan identitas konsisten; tidak ditebak.',
            'No HP sebaiknya Text agar nol awal tidak hilang. Angka bulat maksimal 15 digit diterima tanpa menambahkan nol awal.',
            'Batas 5000 baris data dan ukuran file 5 MB. Rumus/formula tidak diperbolehkan.',
            'NIK/NIP/nama duplikat atau identitas ambigu ditolak. Kolom opsional kosong tidak menghapus data lama.',
            'Preview tidak menyimpan data. Konfirmasikan dry_run=false untuk menyimpan seluruh baris valid secara atomik.',
        ):
            _text_cell(instructions.cell(instructions.max_row + (1 if instructions['A1'].value else 0), 1), text)
        instructions.column_dimensions['A'].width = 120
        _sheet(wb, 'Contoh', [
            ['', '012345678901234567', 'Contoh ASN NIP saja', 'Diskominfo', '', '08123456789', '', ''],
            ['0123456789012345', '', 'Contoh non-ASN NIK saja', '', '', '', '', 'hadir'],
        ])
    out = BytesIO()
    wb.save(out)
    return out.getvalue()


def _check_archive(content):
    """Bound resources before openpyxl parses shared strings/styles/dimensions."""
    try:
        with ZipFile(BytesIO(content)) as archive:
            members = archive.infolist()
            if len(members) > 100 or len({m.filename for m in members}) != len(members):
                raise XlsxError('Arsip XLSX memiliki terlalu banyak/duplikat komponen.')
            if sum(m.file_size for m in members) > MAX_EXPANDED_BYTES:
                raise XlsxError('Ukuran hasil ekstraksi XLSX melebihi 25 MB.')
            for member in members:
                if member.flag_bits & 1 or member.filename.startswith('/') or '..' in member.filename.split('/'):
                    raise XlsxError('Komponen arsip XLSX tidak aman.')
                if 'vbaProject' in member.filename or member.filename.startswith('xl/externalLinks/'):
                    raise XlsxError('Macro dan tautan workbook eksternal tidak diperbolehkan.')
                if member.file_size > 1024 * 1024 and member.file_size / max(member.compress_size, 1) > 200:
                    raise XlsxError('Rasio kompresi XLSX tidak aman.')
                if not member.filename.endswith('.xml'):
                    continue
                xml = archive.read(member)
                markup = xml.replace(b'\x00', b'').upper()  # also UTF-16/32 XML
                if b'<!DOCTYPE' in markup or b'<!ENTITY' in markup:
                    raise XlsxError('Deklarasi DTD/entity tidak diperbolehkan.')
                # Scan every worksheet, including ignored example/instruction sheets.
                if not member.filename.startswith('xl/worksheets/'):
                    continue
                for _, element in ElementTree.iterparse(BytesIO(xml), events=('end',)):
                    tag = element.tag.rsplit('}', 1)[-1]
                    if tag == 'f':
                        raise XlsxError('Formula tidak diperbolehkan dalam workbook.')
                    if tag == 'row' and (int(element.get('r', '0')) > MAX_ROWS + 1):
                        raise XlsxError('Maksimal 5000 baris data per sheet.')
                    if tag == 'c':
                        ref = re.fullmatch(r'([A-Z]+)([0-9]+)', element.get('r', ''))
                        if not ref or column_index_from_string(ref[1]) > 64 or int(ref[2]) > MAX_ROWS + 1:
                            raise XlsxError('Rentang sel XLSX terlalu besar/tidak valid.')
                    element.clear()
    except XlsxError:
        raise
    except (BadZipFile, ElementTree.ParseError, KeyError, RuntimeError, OverflowError, ValueError, NotImplementedError) as exc:
        raise XlsxError('File bukan workbook XLSX yang valid.') from exc


def read_rows(upload):
    if not upload or not upload.name.lower().endswith('.xlsx'):
        raise XlsxError('Unggah file .xlsx pada field file.')
    if upload.size > MAX_BYTES:
        raise XlsxError('Ukuran file maksimal 5 MB.')
    content = upload.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise XlsxError('Ukuran file maksimal 5 MB.')
    _check_archive(content)
    wb = None
    try:
        wb = load_workbook(BytesIO(content), read_only=True, data_only=False, keep_links=False)
        if len(wb.worksheets) > 10:
            raise XlsxError('Maksimal 10 sheet dalam workbook.')
        # Excel's first sheet is accepted for third-party workbooks, except the
        # known help/example tabs which must never become import data.
        ws = wb['Absensi'] if 'Absensi' in wb.sheetnames else wb.worksheets[0]
        if ws.title.casefold() in ('contoh', 'petunjuk'):
            raise XlsxError('Sheet Absensi tidak ditemukan.')
        ws.reset_dimensions()  # do not trust attacker-controlled dimension metadata
        iterator = ws.iter_rows()
        header = next(iterator, ())
        titles = tuple(str(c.value or '').strip() for c in header)
        if titles[:8] != HEADERS or any(titles[8:]):
            raise XlsxError('Kolom wajib berurutan: ' + ', '.join(HEADERS) + '.')
        rows = []
        for number, cells in enumerate(iterator, 2):
            if number > MAX_ROWS + 1:
                raise XlsxError('Maksimal 5000 baris data.')
            if not any(c.value is not None and str(c.value).strip() for c in cells):
                continue
            errors = []
            if any(c.value is not None and str(c.value).strip() for c in cells[8:]):
                errors.append('Data di luar delapan kolom tidak diperbolehkan.')
            values = {}
            for index, field in enumerate(FIELDS):
                cell = cells[index] if index < len(cells) else None
                value = cell.value if cell else None
                if cell and cell.data_type == 'f':
                    errors.append('Formula tidak diperbolehkan.')
                if field in ('nik', 'nip') and value is not None and not isinstance(value, str):
                    errors.append({'column': HEADERS[index],
                        'message': f'{HEADERS[index]}: format angka ilmiah/digit mungkin berubah; ubah kolom ke Text dan tempel ulang dari sumber asli.',
                        'hint': 'Ubah kolom ke Text dan tempel ulang dari sumber asli; jangan mengubah angka yang sudah dibulatkan menjadi teks.'})
                if field == 'phone' and value is not None and not isinstance(value, str):
                    if isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value < 10 ** 15 and value == int(value):
                        value = str(int(value))
                    else:
                        errors.append({'column': 'No HP', 'message': 'No HP numerik tidak aman; gunakan teks dari sumber asli.', 'hint': 'Gunakan Text; nol awal yang hilang tidak dapat dipulihkan.'})
                values[field] = str(value).strip() if value is not None else ''
                if field in ('nik', 'nip') and values[field] in ('-', '—'):
                    values[field] = ''
            values['status'] = values['status'] or Attendance.Status.HADIR
            rows.append({'row': number, **values, '_errors': errors})
        return rows
    except XlsxError:
        raise
    except (ValueError, TypeError, KeyError, IndexError, BadZipFile, ElementTree.ParseError, OSError, InvalidFileException) as exc:
        raise XlsxError('File bukan workbook XLSX yang valid.') from exc
    finally:
        if wb is not None:
            wb.close()


def _name(value):
    return ' '.join(value.split()).casefold()


def preview(event, source_rows, dry_run):
    participants = list(Participant.objects.filter(event=event))
    by_nik, by_nip, by_name = defaultdict(list), defaultdict(list), defaultdict(set)
    for p in participants:
        # Never put null/empty identities in identity maps.
        if p.nik:
            by_nik[p.nik].append(p)
        if p.nip:
            by_nip[p.nip].append(p)
        by_name[_name(p.full_name)].add(p.pk)
    missing_nik_nips = {r['nip'] for r in source_rows if not r['nik'] and r['nip']}
    across_nip = defaultdict(list)
    for p in Participant.objects.filter(nip__in=missing_nik_nips).exclude(event=event):
        across_nip[p.nip].append(p)
    attendances = {a.participant_id: a for a in Attendance.objects.filter(event=event)}
    seen = {f: {} for f in ('nip', 'full_name')}
    seen_niks = {}
    result = {'rows': [], 'created': 0, 'updated': 0, 'errors': [], 'dry_run': dry_run}
    for source in source_rows:
        row = {k: v for k, v in source.items() if k != '_errors'}
        errors = []

        def error(column, message, hint='Periksa identitas pada sumber asli dan data peserta; jangan menebak identitas.'):
            errors.append({'row': row['row'], 'column': column, 'message': message, 'hint': hint})

        for message in source['_errors']:
            if isinstance(message, dict):
                errors.append({'row': row['row'], **message})
            else:
                error(None, message)
        candidate = Participant(event=event)
        parse_error_columns = {issue.get('column') for issue in source['_errors'] if isinstance(issue, dict)}
        for field in FIELDS[:-1]:
            # An unsafe numeric identity already has an actionable source error.
            # Do not bury it under additional regex/length errors for the same cell.
            if HEADERS[FIELDS.index(field)] in parse_error_columns:
                continue
            try:
                Participant._meta.get_field(field).clean(row[field] or (None if field == 'nik' else ''), candidate)
            except ValidationError as exc:
                for message in exc.messages:
                    error(HEADERS[FIELDS.index(field)], message, 'Perbaiki nilai kolom sesuai format dan panjang yang diminta.')
        if not row['nik'] and not row['nip']:
            error('NIK/NIP', 'Isi minimal satu identitas: NIP 18 digit untuk ASN atau NIK 16 digit jika NIP tidak ada.')
        if row['status'] not in Attendance.Status.values:
            error('Status', 'Status harus hadir atau tidak_hadir.', 'Kosongkan untuk default hadir atau pilih hadir/tidak_hadir.')
        name = _name(row['full_name'])
        for field in seen:
            value = name if field == 'full_name' else row[field]
            if not value:
                continue
            column = HEADERS[FIELDS.index(field)]
            if value in seen[field]:
                error(column, f'{column} duplikat/ambigu dengan baris {seen[field][value]}.', 'Hapus duplikat; satu baris per peserta.')
            seen[field][value] = row['row']

        nik_matches = by_nik.get(row['nik'], []) if row['nik'] else []
        nip_matches = by_nip.get(row['nip'], []) if row['nip'] else []
        for column, matches in (('NIK', nik_matches), ('NIP', nip_matches)):
            if len(matches) > 1:
                error(column, f'{column} cocok dengan beberapa peserta pada kegiatan ini; identitas ambigu.')
        nik_p = nik_matches[0] if len(nik_matches) == 1 else None
        nip_p = nip_matches[0] if len(nip_matches) == 1 else None
        if nik_p and nip_p and nik_p.pk != nip_p.pk:
            error('NIK/NIP', 'NIK dan NIP menunjuk peserta berbeda pada kegiatan ini.')
        p = nik_p or nip_p
        if p:
            if _name(p.full_name) != name:
                error('Nama Lengkap', 'NIK/NIP sudah terdaftar dengan nama berbeda pada kegiatan ini.')
            if row['nik'] and p.nik and row['nik'] != p.nik:
                error('NIK', 'NIP sudah terdaftar dengan NIK berbeda.')
            if row['nip'] and p.nip and row['nip'] != p.nip:
                error('NIP', 'NIK sudah terdaftar dengan NIP berbeda.')
        if not row['nik'] and row['nip']:
            # Exact NIP only; names are compatibility checks, never lookup keys.
            matches = nip_matches + across_nip.get(row['nip'], [])
            known_niks = {match.nik for match in matches if match.nik}
            if any(_name(match.full_name) != name for match in matches):
                error('Nama Lengkap', 'NIP ditemukan dengan nama berbeda; konfirmasi identitas sebelum impor.')
            if len(known_niks) > 1:
                error('NIP', 'NIP memiliki beberapa NIK berbeda antar kegiatan; identitas konflik.')
            elif known_niks:
                row['nik'] = next(iter(known_niks))
                recovered = by_nik.get(row['nik'], [])
                if recovered:
                    if len(recovered) != 1 or (p and recovered[0].pk != p.pk):
                        error('NIK/NIP', 'NIK dari NIP menunjuk peserta berbeda/ambigu pada kegiatan ini.')
                    elif _name(recovered[0].full_name) != name or (recovered[0].nip and recovered[0].nip != row['nip']):
                        error('NIK/NIP', 'NIK dari NIP bertentangan dengan nama/NIP peserta pada kegiatan ini.')
                    else:
                        p = recovered[0]
        # Check effective NIK after recovery as well as supplied identities.
        if row['nik']:
            if row['nik'] in seen_niks:
                error('NIK', f'NIK duplikat/konflik dengan baris {seen_niks[row["nik"]]}.', 'Hapus duplikat atau periksa NIP yang menghasilkan NIK sama.')
            seen_niks[row['nik']] = row['row']
        if name and by_name.get(name, set()) - ({p.pk} if p else set()):
            error('Nama Lengkap', 'Nama sudah terdaftar pada peserta lain dalam kegiatan ini; identitas ambigu.')
        a = attendances.get(p.pk) if p else None
        row.update(participant_id=str(p.pk) if p else None, attendance_id=str(a.pk) if a else None, action=None)
        row['nik'] = row['nik'] or None
        if errors:
            result['errors'].extend(errors)
        else:
            row['action'] = 'updated' if a else 'created'
            result[row['action']] += 1
        result['rows'].append(row)
    return result


def apply_rows(event, result):
    """Caller owns atomic transaction and event lock; validate before any writes."""
    for row in result['rows']:
        defaults = {field: row[field] for field in FIELDS[:-1] if row[field] not in ('', None)}
        if row['nip']:
            defaults['is_asn'] = True
        if row['participant_id']:
            # Includes a NIP-only participant acquiring a verified NIK later.
            participant = Participant.objects.get(event=event, pk=row['participant_id'])
            for field, value in defaults.items():
                setattr(participant, field, value)
            participant.save()
        else:
            participant = Participant.objects.create(event=event, nik=row['nik'], **{k: v for k, v in defaults.items() if k != 'nik'})
        attendance, _ = Attendance.objects.update_or_create(event=event, participant=participant, defaults={'status': row['status']})
        row['participant_id'] = str(participant.pk)
        row['attendance_id'] = str(attendance.pk)
