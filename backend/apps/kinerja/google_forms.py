import logging
import threading

import requests

logger = logging.getLogger(__name__)
GFORM_TIMEOUT = 10


def _build_submit_url(form_url):
    url = form_url.strip()
    if '?' in url:
        url = url[:url.index('?')]
    if '#' in url:
        url = url[:url.index('#')]
    for suffix in ('/viewform', '/edit', '/formResponse', '/prefill'):
        if url.endswith(suffix):
            url = url[: -len(suffix)]
            break
    url = url.rstrip('/')
    return url + '/formResponse'


def _post_to_google_form(form_url, entry_nama, entry_nip, entry_uraian,
                          nama, nip, uraian, link_bukti='', tanggal='',
                          entry_link_bukti='', entry_tanggal=''):
    if not entry_nama or not entry_nip or not entry_uraian:
        logger.warning('[GoogleForms] Entry ID belum diisi di periode. Submission dilewati.')
        return

    submit_url = _build_submit_url(form_url)
    payload = {
        entry_nama: nama,
        entry_nip: nip,
        entry_uraian: uraian,
    }
    if entry_link_bukti and link_bukti:
        payload[entry_link_bukti] = link_bukti
    if entry_tanggal and tanggal:
        payload[entry_tanggal] = tanggal

    try:
        resp = requests.post(
            submit_url,
            data=payload,
            timeout=GFORM_TIMEOUT,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 SILAKHADIR/1.0',
            },
            allow_redirects=True,
        )
        logger.info('[GoogleForms] Submission status: %s | NIP: %s', resp.status_code, nip)
    except requests.exceptions.Timeout:
        logger.warning('[GoogleForms] Timeout saat mengirim ke: %s', submit_url)
    except requests.exceptions.ConnectionError as exc:
        logger.warning('[GoogleForms] Koneksi gagal: %s | %s', submit_url, exc)
    except Exception as exc:
        logger.error('[GoogleForms] Error: %s', exc, exc_info=True)


def submit_to_google_form(periode, kinerja_entry):
    google_form_url = getattr(periode, 'google_form_url', '') or ''
    if not google_form_url.strip():
        return

    entry_nama = getattr(periode, 'gform_entry_nama', '') or ''
    entry_nip = getattr(periode, 'gform_entry_nip', '') or ''
    entry_uraian = getattr(periode, 'gform_entry_uraian', '') or ''
    entry_link_bukti = getattr(periode, 'gform_entry_link_bukti', '') or ''
    entry_tanggal = getattr(periode, 'gform_entry_tanggal', '') or ''

    tanggal_str = str(kinerja_entry.tanggal) if kinerja_entry.tanggal else ''

    thread = threading.Thread(
        target=_post_to_google_form,
        kwargs={
            'form_url': google_form_url,
            'entry_nama': entry_nama,
            'entry_nip': entry_nip,
            'entry_uraian': entry_uraian,
            'entry_link_bukti': entry_link_bukti,
            'entry_tanggal': entry_tanggal,
            'nama': kinerja_entry.nama_pegawai or '',
            'nip': kinerja_entry.nip_pegawai or '',
            'uraian': kinerja_entry.uraian_kegiatan or '',
            'link_bukti': kinerja_entry.link_bukti or '',
            'tanggal': tanggal_str,
        },
        daemon=True,
        name='gform-' + str(kinerja_entry.id),
    )
    thread.start()
    logger.debug('[GoogleForms] Thread dimulai: %s', thread.name)
