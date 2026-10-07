import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import ModalForm from '../../components/ModalForm'
import PdfPreviewModal from './PdfPreviewModal'
import CertificateParticipantSelect from '../../components/CertificateParticipantSelect'
import { previewFinalCertificates, applyFinalCertificates } from '../../api/finalImportApi'
import { parsePageGroups, validateFiles, validateAssignments, importError } from '../../utils/importWorkflow.mjs'
import { initializeCertificateReview, updateCertificateReview, canVerifyCertificateRow, verifyCertificateRow, verifyAllCertificates, certificateReviewError, certificateAssignments } from '../../utils/certificateReview.mjs'

import { applyCertificateNumberMode, updateCertificateNumber, certificateNumberError } from '../../utils/certificateNumbers.mjs'

const MATCH_LABELS = { matched: 'Cocok otomatis', exact: 'Cocok persis', ready: 'Siap ditinjau', unmatched: 'Belum cocok', ambiguous: 'Nama ambigu', duplicate: 'Peserta duplikat', manual: 'Periksa manual', needs_review: 'Perlu verifikasi' }

export default function BulkUploadModal({ open, onClose, eventId, onUploaded, single = false }) {
  const [files, setFiles] = useState([])
  const [mode, setMode] = useState(single ? 'separate' : 'combined')
  const [pages, setPages] = useState(1)
  const [custom, setCustom] = useState(false)
  const [ranges, setRanges] = useState('')
  const [batch, setBatch] = useState(null)
  const [items, setItems] = useState([])
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [numberMode, setNumberMode] = useState('detected')
  const [commonNumber, setCommonNumber] = useState('')

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const requestVersion = useRef(0)

  const invalidate = () => { requestVersion.current += 1; setBatch(null); setItems([]); setReplaceExisting(false); setNumberMode('detected'); setCommonNumber(''); setBusy(''); setError(''); setPreviewUrl('') }
  useEffect(() => {
    if (open) {
      setFiles([]); setMode(single ? 'separate' : 'combined'); setPages(1); setCustom(false); setRanges(''); invalidate()
      setBusy('')
    }
    return () => { requestVersion.current += 1 }
  }, [open, eventId, single])

  const pickFiles = (event) => {
    const picked = Array.from(event.target.files || [])
    event.target.value = ''
    invalidate()
    const validation = validateFiles(picked, 'pdf')
    if (validation || ((mode === 'combined' || single) && picked.length !== 1)) {
      setFiles([]); setError(validation || 'Pilih tepat satu PDF.'); return
    }
    setFiles(picked)
  }

  const runPreview = async () => {
    invalidate()
    const validation = validateFiles(files, 'pdf')
    if (validation) { setError(validation); return }
    if ((mode === 'combined' || single) && files.length !== 1) { setError('Pilih tepat satu PDF.'); return }
    let pageGroups
    if (mode === 'combined') {
      if (custom) {
        try { pageGroups = parsePageGroups(ranges) } catch (err) { setError(err.message); return }
      } else if (!Number.isSafeInteger(Number(pages)) || Number(pages) < 1) { setError('Halaman per peserta harus bilangan bulat positif.'); return }
    }
    setBusy('preview')
    const version = requestVersion.current
    try {
      const { data } = await previewFinalCertificates(eventId, { files, mode, pagesPerParticipant: mode === 'separate' || custom ? 1 : Number(pages), pageGroups })
      if (version !== requestVersion.current) return
      if (!data.batch_id || !Array.isArray(data.items) || !Array.isArray(data.participants)) throw new Error('Respons pratinjau tidak lengkap. Coba kembali.')
      setBatch(data)
      setItems(initializeCertificateReview(data.items.map(item => ({ ...item, certificate_number: item.detected_number ?? item.certificate_number ?? '', detected_number: item.detected_number ?? item.certificate_number ?? '' })), data.participants))
    } catch (err) { if (version === requestVersion.current) setError(importError(err, err.message || 'Gagal membuat pratinjau PDF.')) }
    finally { if (version === requestVersion.current) setBusy('') }
  }

  const mappingError = batch ? validateAssignments(items, batch.participants) : ''
  const reviewError = batch ? certificateReviewError(items, batch.participants) : ''
  const assigned = items.filter((item) => item.participant_id !== '' && item.participant_id != null)
  const verifiedCount = assigned.filter((item) => item.verified).length
  const updateItem = (id, field, value) => {
    setItems((current) => field === 'certificate_number' ? updateCertificateNumber(current, id, value) : current.find(item => item.id === id)?.[field] === value ? current : updateCertificateReview(current, id, field, value))
    setError('')
  }
  const applyCommonNumber = async () => {
    if (busy) return
    const validation = certificateNumberError(commonNumber)
    if (validation) { setError(validation); return }
    const version = requestVersion.current
    setBusy('number-confirm')
    try {
      if (!commonNumber.trim()) {
        const { isConfirmed } = await Swal.fire({ icon: 'warning', title: 'Kosongkan semua nomor impor?', text: 'Nomor metadata pada semua baris pratinjau akan dikosongkan. PDF asli tidak diubah.', showCancelButton: true, confirmButtonText: 'Ya, kosongkan', cancelButtonText: 'Batal' })
        if (!isConfirmed || version !== requestVersion.current) return
      }
      if (version === requestVersion.current) { setItems(current => applyCertificateNumberMode(current, 'same', commonNumber.trim())); setError('') }
    } finally { if (version === requestVersion.current) setBusy('') }
  }
  const apply = async () => {
    if (!batch || busy || reviewError) return
    setBusy('confirm')
    const version = requestVersion.current
    try {
      const { isConfirmed } = await Swal.fire({
        icon: replaceExisting ? 'warning' : 'question', title: 'Terapkan pemetaan sertifikat?',
        text: `${assigned.length} sertifikat akan diterapkan; ${items.length - assigned.length} berkas tanpa peserta dilewati.${replaceExisting ? ' PERINGATAN: sertifikat peserta yang sudah ada akan diganti.' : ' Sertifikat yang sudah ada tidak akan diganti.'}`,
        showCancelButton: true, confirmButtonText: 'Ya, terapkan', cancelButtonText: 'Batal',
      })
      if (!isConfirmed || version !== requestVersion.current) return
      setBusy('apply'); setError('')
      await applyFinalCertificates(eventId, {
        batch_id: batch.batch_id,
        assignments: certificateAssignments(items, batch.participants),
        replace_existing: replaceExisting,
      })
      if (version !== requestVersion.current) return
      setBusy(''); invalidate(); setFiles([])
      onUploaded?.(); onClose?.()
      Swal.fire({ icon: 'success', title: 'Impor sertifikat selesai', text: 'Pemetaan PDF final telah diterapkan.' })
    } catch (err) { if (version === requestVersion.current) setError(importError(err, 'Gagal menerapkan sertifikat. Periksa pemetaan atau buat pratinjau baru.')) }
    finally { if (version === requestVersion.current) setBusy('') }
  }

  return <>
    <ModalForm open={open} onClose={() => { if (!busy && !previewUrl) onClose?.() }} title={single ? 'Unggah PDF final untuk peserta' : 'Impor sertifikat PDF final Canva'} maxWidth="max-w-6xl">
      <div className="space-y-4">
        <p className="text-sm text-ink-700">Unggah PDF yang sudah lengkap dan ditandatangani dari Canva. Sistem hanya memisahkan halaman dan memetakan ke peserta hadir, tanpa menambah nama, nomor, barcode, atau tanda tangan pada PDF.</p>
        <fieldset disabled={Boolean(busy)} className="space-y-3 disabled:opacity-60">
          {!single && <label className="label">Bentuk berkas<select className="input mt-1" value={mode} onChange={(e) => { setMode(e.target.value); setFiles([]); invalidate() }}>
            <option value="combined">Satu PDF gabungan (pisahkan per peserta)</option>
            <option value="separate">Banyak PDF yang sudah dipisahkan per peserta</option>
          </select></label>}
          {mode === 'combined' && <div className="rounded border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={custom} onChange={(e) => { setCustom(e.target.checked); invalidate() }} /> Gunakan rentang manual (jumlah halaman tiap peserta berbeda)</label>
            {custom ? <label className="label">Rentang halaman per peserta<textarea className="input mt-1" rows={3} value={ranges} onChange={(e) => { setRanges(e.target.value); invalidate() }} placeholder="1-2, 3, 4-6" /><span className="block text-xs text-ink-500 mt-1">Mulai dari halaman 1. Pisahkan kelompok dengan koma atau baris baru. Contoh: 1-2 untuk peserta pertama, 3 untuk peserta kedua, 4-6 untuk peserta ketiga. Semua halaman harus tercakup dalam rentang tanpa tumpang tindih.</span></label>
              : <label className="label">Jumlah halaman per peserta<input type="number" min="1" step="1" className="input mt-1" value={pages} onChange={(e) => { setPages(e.target.value); invalidate() }} /></label>}
          </div>}
          <label className="label">Berkas PDF<input key={`${mode}-${single}`} type="file" className="input mt-1" accept=".pdf,application/pdf" multiple={mode === 'separate' && !single} onChange={pickFiles} /><span className="block text-xs text-ink-500 mt-1">Maksimal total 50 MB, 100 berkas dan 200 halaman per impor. Memilih berkas baru menggantikan pilihan sebelumnya.</span></label>
          {files.length > 0 && <ul className="max-h-28 overflow-y-auto text-sm list-disc pl-5">{files.map((file, i) => <li key={i}>{file.name}</li>)}</ul>}
          <button type="button" onClick={runPreview} className="btn-outline" disabled={!files.length}>{busy === 'preview' ? 'Memproses pratinjau...' : '1. Buat pratinjau dan pencocokan'}</button>
        </fieldset>
        {error && <p role="alert" className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">{error}</p>}
        {batch && <section className="space-y-3">
          <h4 className="font-semibold">2. Tinjau dan koreksi pemetaan ({items.length} berkas)</h4>
          <p className="text-sm text-ink-500">Hanya peserta hadir dari server tersedia di pilihan. Nama hasil deteksi bukan bukti pasti; periksa PDF dan identitas peserta. Pilih “Lewati” untuk berkas yang tidak cocok. Nomor bersifat metadata opsional, tidak dicetak ke PDF.</p>
          {!batch.participants.length && <p role="alert" className="text-amber-700">Belum ada peserta hadir untuk dipetakan. Unggah absensi dahulu, kemudian buat pratinjau ulang.</p>}
          <fieldset disabled={Boolean(busy)} className="rounded border p-3 space-y-2">
            <label className="label">Mode nomor sertifikat<select className="input mt-1" value={numberMode} onChange={e => setNumberMode(e.target.value)}>
              <option value="detected">Berbeda per peserta / hasil deteksi No: dari PDF</option>
              <option value="same">Nomor sama untuk semua berkas impor</option>
            </select></label>
            <p className="text-xs text-ink-500">Nomor hasil deteksi server diisi saat pratinjau dibuat. Semua nomor tetap dapat dikoreksi per baris; mengganti mode saja tidak menimpa koreksi. Perubahan nomor membatalkan verifikasi hanya pada baris yang berubah.</p>
            {numberMode === 'same' && <div className="flex flex-wrap items-end gap-2"><label className="label flex-1">Nomor bersama (maksimal 100 karakter)<input className="input mt-1" maxLength={100} value={commonNumber} onChange={e => setCommonNumber(e.target.value)} placeholder="Boleh kosong dengan konfirmasi" /></label><button type="button" className="btn-outline" onClick={applyCommonNumber}>Terapkan ke semua berkas impor</button></div>}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline" disabled={Boolean(busy) || Boolean(mappingError)} onClick={() => setItems((current) => verifyAllCertificates(current, batch.participants, true))}>Verifikasi SEMUA</button>
            <button type="button" className="btn-outline" disabled={Boolean(busy) || !verifiedCount} onClick={() => setItems((current) => verifyAllCertificates(current, batch.participants, false))}>Batalkan SEMUA verifikasi</button>
            <span className="text-sm" role="status">Terverifikasi: {verifiedCount} dari {assigned.length} berkas dipilih.</span>
          </div>
          <p className="text-xs text-ink-500">Verifikasi menyatakan PDF dan identitas sudah diperiksa. Batalkan verifikasi untuk meninjau ulang; perubahan peserta atau nomor membatalkan verifikasi baris tersebut.</p>
          <div className="overflow-x-auto max-h-[45vh] overflow-y-auto border rounded"><table className="table-base"><thead><tr><th>Berkas / halaman</th><th>Nama terdeteksi / kecocokan</th><th>Peserta hadir</th><th>Nomor (opsional)</th><th>PDF</th><th>Verifikasi</th></tr></thead><tbody>
            {items.map((item) => <tr key={item.id}>
              <td><div className="text-sm break-all">{item.filename}</div><div className="text-xs text-ink-500">Halaman {item.page_start ?? '-'}–{item.page_end ?? '-'} ({item.page_count ?? '-'} halaman)</div></td>
              <td><div>{item.detected_name || 'Nama tidak terdeteksi'}</div><span className="text-xs text-ink-500">{MATCH_LABELS[item.match_status] || 'Periksa hasil pencocokan'}</span>{item.participant_name && <div className="text-xs">Saran: {item.participant_name}</div>}</td>
              <td><CertificateParticipantSelect label={`Peserta untuk ${item.filename}, halaman ${item.page_start}`} participants={batch.participants} disabled={Boolean(busy)} value={item.participant_id} onChange={(value) => updateItem(item.id, 'participant_id', value)} /></td>
              <td><input aria-label={`Nomor sertifikat ${item.filename}`} maxLength={100} disabled={Boolean(busy)} className="input min-w-[170px]" value={item.certificate_number} onChange={(e) => updateItem(item.id, 'certificate_number', e.target.value)} placeholder="Boleh kosong" /></td>
              <td>{item.preview_url ? <button type="button" disabled={Boolean(busy)} className="btn-outline" onClick={() => setPreviewUrl(item.preview_url)}>Lihat PDF</button> : <span className="text-xs text-ink-500">Tidak tersedia</span>}</td>
              <td><div className="space-y-1"><span className={`block text-xs ${item.verified ? 'text-green-700' : 'text-ink-500'}`}>{item.verified ? 'Terverifikasi' : item.participant_id === '' ? 'Dilewati' : 'Belum diverifikasi'}</span><button type="button" aria-label={`${item.verified ? 'Batalkan verifikasi' : 'Verifikasi'} ${item.filename}, halaman ${item.page_start}`} className="btn-outline whitespace-nowrap" disabled={Boolean(busy) || (!item.verified && !canVerifyCertificateRow(items, item, batch.participants))} onClick={() => setItems((current) => verifyCertificateRow(current, item.id, batch.participants, !item.verified))}>{item.verified ? 'Batalkan verifikasi' : 'Verifikasi'}</button></div></td>
            </tr>)}
          </tbody></table></div>
          {mappingError && <p role="alert" className="text-amber-700 text-sm">{mappingError}</p>}
          <p className="text-sm">Akan diterapkan: <strong>{assigned.length}</strong>. Dilewati: <strong>{items.length - assigned.length}</strong>.</p>
          <label className="flex items-start gap-2 p-3 border border-amber-300 bg-amber-50 rounded text-sm"><input type="checkbox" disabled={Boolean(busy)} checked={replaceExisting} onChange={(e) => { setReplaceExisting(e.target.checked); setItems((current) => verifyAllCertificates(current, batch.participants, false)) }} /><span><strong>Ganti sertifikat yang sudah ada.</strong> Peringatan: PDF lama peserta yang dipilih akan diganti. Biarkan tidak dicentang untuk melindungi sertifikat lama.</span></label>
          {!mappingError && reviewError && <p role="alert" className="text-amber-700 text-sm">{reviewError}</p>}
          <button type="button" onClick={apply} disabled={Boolean(busy) || Boolean(reviewError)} className="btn-primary">{busy === 'apply' ? 'Menerapkan...' : '3. Konfirmasi dan terapkan pemetaan'}</button>
        </section>}
      </div>
    </ModalForm>
    <PdfPreviewModal url={previewUrl} onClose={() => setPreviewUrl('')} />
  </>
}
