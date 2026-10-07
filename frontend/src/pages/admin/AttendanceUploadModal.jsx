import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import ModalForm from '../../components/ModalForm'
import { downloadAttendanceXlsx, importAttendanceXlsx, importAttendanceRows } from '../../api/finalImportApi'
import { validateFiles, importError, attendanceValidationIssues } from '../../utils/importWorkflow.mjs'
import { ATTENDANCE_FIELDS, STATUS_OPTIONS, attendanceRowsPayload, createAttendanceDraft, changeAttendanceDraft, acceptAttendanceValidation, canApplyAttendance, useAttendanceSystemData, attendanceDraftPage, discardAttendanceRowResult } from '../../utils/editableAttendance.mjs'

export default function AttendanceUploadModal({ open, onClose, eventId, onImported }) {
  const [file, setFile] = useState(null)
  const [draft, setDraft] = useState(() => createAttendanceDraft())
  const draftRef = useRef(draft)
  const [result, setResult] = useState(null)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  const updateDraft = next => { draftRef.current = next; setDraft(next) }
  useEffect(() => {
    requestVersion.current += 1
    if (open) {
      setFile(null); updateDraft(createAttendanceDraft()); setResult(null); setPage(0); setError(''); setBusy('')
    }
    return () => { requestVersion.current += 1 }
  }, [open, eventId])

  const download = async kind => {
    const version = ++requestVersion.current
    setBusy(kind); setError('')
    try { await downloadAttendanceXlsx(eventId, kind) }
    catch (err) { if (version === requestVersion.current) setError(importError(err, 'Gagal mengunduh berkas Excel.')) }
    finally { if (version === requestVersion.current) setBusy('') }
  }
  const pick = event => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    requestVersion.current += 1
    updateDraft(createAttendanceDraft()); setResult(null); setPage(0); setError(''); setBusy('')
    const validation = validateFiles(picked ? [picked] : [], 'xlsx')
    if (validation) { setFile(null); setError(validation); return }
    setFile(picked)
  }
  const edit = (index, changes) => {
    requestVersion.current += 1
    updateDraft(changeAttendanceDraft(draftRef.current, index, changes))
    setResult(current => discardAttendanceRowResult(current, draftRef.current.rows[index].row)); setError(''); setBusy('')
  }
  const receive = (data, initial, revision) => {
    // JSON validation must never replace the entered values with server-normalized rows.
    const current = initial ? createAttendanceDraft(Array.isArray(data?.rows) ? data.rows : []) : draftRef.current
    updateDraft(acceptAttendanceValidation(current, data, initial ? current.revision : revision))
    setResult(data)
  }
  const preview = async (initial = false) => {
    try {
      if (initial) {
        const validation = validateFiles(file ? [file] : [], 'xlsx')
        if (validation) { setError(validation); return }
      } else attendanceRowsPayload(draftRef.current.rows)
    } catch (err) { setError(err.message); return }
    const revision = draftRef.current.revision
    const submittedRows = draftRef.current.rows
    updateDraft({ ...draftRef.current, validation: null, validatedRevision: null, confirmed: false })
    setBusy('preview'); setError(''); setResult(null)
    const version = ++requestVersion.current
    try {
      const { data } = initial
        ? await importAttendanceXlsx(eventId, file, true)
        : await importAttendanceRows(eventId, submittedRows, true)
      if (version !== requestVersion.current || revision !== draftRef.current.revision) return
      receive(data, initial, revision)
      if (data.dry_run !== true || !Array.isArray(data.errors) || !Array.isArray(data.rows)) throw new Error('Respons validasi absensi tidak lengkap. Validasi ulang sebelum menyimpan.')
    } catch (err) {
      if (version !== requestVersion.current || revision !== draftRef.current.revision) return
      const data = err?.response?.data
      if (Array.isArray(data?.rows) || Array.isArray(data?.errors)) receive(data, initial, revision)
      setError(importError(err, err.message || 'Gagal memeriksa absensi. Perubahan Anda tetap tersimpan di pratinjau.'))
    } finally { if (version === requestVersion.current) setBusy('') }
  }
  const apply = async () => {
    if (!canApplyAttendance(draftRef.current) || busy) return
    const version = requestVersion.current
    const revision = draftRef.current.revision
    const submittedRows = draftRef.current.rows
    setBusy('confirm')
    try {
      const count = submittedRows.filter(row => !row.skipped).length
      const { isConfirmed } = await Swal.fire({ icon: 'question', title: 'Simpan absensi yang telah ditinjau?', text: `${count} baris aktif akan menyimpan data peserta dan kehadiran sesuai perubahan yang sudah divalidasi. Baris dilewati tidak disimpan. Tidak membuat sertifikat; sertifikat hanya berasal dari berkas PDF asli yang diimpor terpisah.`, showCancelButton: true, confirmButtonText: 'Ya, simpan data', cancelButtonText: 'Batal' })
      if (!isConfirmed || version !== requestVersion.current || revision !== draftRef.current.revision || !canApplyAttendance(draftRef.current)) return
      setBusy('apply'); setError('')
      const { data } = await importAttendanceRows(eventId, submittedRows, false)
      if (version !== requestVersion.current) return
      if (data.errors?.length) {
        updateDraft({ ...draftRef.current, validation: null, validatedRevision: null, confirmed: false })
        setResult(data); setError(importError({ response: { data } }, 'Absensi belum disimpan. Perbaiki langsung di sini lalu validasi ulang.')); return
      }
      if (data.dry_run !== false) throw new Error('Server belum mengonfirmasi penyimpanan absensi. Periksa data sebelum mencoba kembali.')
      updateDraft(createAttendanceDraft()); setResult(null); setFile(null)
      onImported?.(); onClose?.()
      Swal.fire({ icon: 'success', title: 'Absensi berhasil disimpan', text: `${data.created ?? 0} ditambahkan, ${data.updated ?? 0} diperbarui. Data peserta dan kehadiran mengikuti data yang telah ditinjau; tidak membuat sertifikat.` })
    } catch (err) {
      if (version === requestVersion.current) {
        updateDraft({ ...draftRef.current, validation: null, validatedRevision: null, confirmed: false })
        setResult(err?.response?.data || null)
        setError(importError(err, err.message || 'Gagal menyimpan absensi. Perubahan Anda tetap ada. Validasi ulang sebelum mencoba kembali.'))
      }
    } finally { if (version === requestVersion.current) setBusy('') }
  }
  const issues = attendanceValidationIssues(result)
  const metadataByRow = new Map((Array.isArray(result?.rows) ? result.rows : []).map(row => [String(row.row), row]))
  const nameByRow = new Map(draft.rows.map(row => [String(row.row), row.full_name]))
  const activeCount = draft.rows.filter(row => !row.skipped).length
  const validCurrent = canApplyAttendance({ ...draft, confirmed: true })
  const locked = ['apply', 'confirm'].includes(busy)
  const draftPage = attendanceDraftPage(draft.rows, page)
  return <ModalForm open={open} onClose={() => { if (!busy) onClose?.() }} title="Unggah dan tinjau absensi Excel (.xlsx)" maxWidth="max-w-6xl">
    <div className="space-y-4">
      <div className="text-sm text-ink-600 space-y-2">
        <p><strong>Wajib: Nama Lengkap dan salah satu NIP atau NIK.</strong> ASN boleh mengisi Nama + NIP tanpa NIK. Non-ASN mengisi Nama + NIK tanpa NIP. Kolom lainnya boleh kosong; Status kosong dianggap hadir.</p>
        <p>Jika NIK kosong, sistem mencari NIK yang sudah dikenal berdasarkan NIP yang cocok. Jika belum ada, data tetap disimpan dengan NIP saja, tanpa NIK buatan.</p>
        <p>Gunakan .xlsx (bukan CSV atau .xls). <strong>Simpan NIP/NIK sebagai Text sebelum menempel data.</strong> Jika nomor sudah berubah menjadi angka ilmiah seperti 1.98E+17, masukkan nomor lengkap dari sumber asli di pratinjau; digit yang hilang tidak dapat ditebak.</p>
        <p><strong>Perbaiki langsung di sini</strong> setelah pratinjau muncul, tanpa unggah ulang. Lewati salah satu baris duplikat lalu validasi ulang perubahan. Maksimal 5000 baris per impor.</p>
        <p>Penyimpanan memperbarui data peserta dan kehadiran yang telah Anda tinjau. Riwayat sertifikat hanya menunjukkan sertifikat yang benar-benar ada; impor absensi tidak membuat sertifikat atau PDF.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => download('template')} className="btn-outline">{busy === 'template' ? 'Mengunduh...' : 'Unduh template absensi .xlsx'}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => download('export')} className="btn-outline">{busy === 'export' ? 'Mengunduh...' : 'Ekspor absensi .xlsx'}</button>
      </div>
      <label className="label">Berkas absensi<input type="file" disabled={Boolean(busy)} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pick} className="input mt-1" /><span className="block text-xs text-ink-500 mt-1">Maksimal 5 MB. {file && `Dipilih: ${file.name}`} Memilih berkas baru mengganti seluruh draf.</span></label>
      <button type="button" disabled={Boolean(busy) || !file || draft.rows.length > 0} onClick={() => preview(true)} className="btn-outline">{busy === 'preview' && !draft.rows.length ? 'Memvalidasi...' : '1. Baca Excel dan pratinjau (belum menyimpan)'}</button>
      {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{error}</p>}
      {(result || draft.rows.length > 0) && <section className="space-y-3">
        <h4 className="font-semibold">Draf absensi yang dapat diperbaiki</h4>
        <p className="text-sm">Baris aktif: {activeCount} · Dilewati: {draft.rows.length - activeCount} · Kesalahan validasi: {issues.length}. Belum ada perubahan yang disimpan.</p>
        {!validCurrent && <p role="status" className="text-sm text-amber-800">Draf belum lolos validasi terbaru. Perbaiki langsung di sini, lalu klik Validasi ulang perubahan sebelum menyetujui penyimpanan.</p>}
        {issues.length > 0 && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800 text-sm space-y-2">
          <p className="font-semibold">Absensi belum disimpan. Perbaiki baris di tabel atau lewati baris duplikat, lalu validasi ulang perubahan.</p>
          <div className="max-h-64 overflow-auto"><table className="table-base"><thead><tr><th>Baris Excel</th><th>Nama</th><th>Kolom</th><th>Penyebab</th><th>Cara memperbaiki</th></tr></thead><tbody>{issues.map((item, i) => <tr key={i}><td>{item.row}</td><td>{nameByRow.get(String(item.row)) || '—'}</td><td>{item.column || 'Validasi'}</td><td className="whitespace-normal">{item.message}</td><td className="whitespace-normal">{item.hint || 'Periksa nilai pada kolom tersebut langsung di tabel draf.'}</td></tr>)}</tbody></table></div>
        </div>}
        {draft.rows.length > 0 && <div className="max-h-[32rem] overflow-auto border rounded"><table className="table-base"><thead><tr><th>Baris Excel</th>{ATTENDANCE_FIELDS.map(field => <th key={field.key}>{field.label}</th>)}<th className="sticky right-40 z-10 bg-white">Data sistem / riwayat sertifikat</th><th className="sticky right-0 z-10 bg-white min-w-[160px] w-40">Tindakan</th></tr></thead><tbody>{draftPage.rows.map((row, relativeIndex) => {
          const index = draftPage.start + relativeIndex
          const metadata = metadataByRow.get(String(row.row))
          const rowIssues = issues.filter(issue => String(issue.row) === String(row.row))
          const conflict = ['conflict', 'ambiguous'].includes(metadata?.system_status)
          const history = metadata?.certificate_history
          const corrected = useAttendanceSystemData(row, metadata)
          const statusLabels = { existing: 'Sudah ada di sistem', new: 'Data baru', conflict: 'Konflik identitas', ambiguous: 'Identitas ambigu — pilih koreksi secara manual' }
          const rowClass = row.skipped ? 'bg-gray-100 opacity-60' : rowIssues.length || metadata?.system_status === 'conflict' ? 'bg-red-50' : metadata?.system_status === 'ambiguous' ? 'bg-amber-50' : metadata?.system_status === 'existing' ? 'bg-green-50' : ''
          return <tr key={`${row.row}-${index}`} className={rowClass}>
            <td>{row.row}{row.skipped && <span className="block text-xs">Dilewati</span>}</td>
            {ATTENDANCE_FIELDS.map(field => {
              const highlighted = !row.skipped && (rowIssues.some(issue => issue.column.toLowerCase() === field.key || issue.column.toLowerCase() === field.label.toLowerCase()) || (conflict && metadata.correction_fields?.includes(field.key)))
              const inputClass = `input min-w-[150px] ${highlighted ? 'border-red-500 bg-red-50 ring-1 ring-red-400' : ''}`
              const label = `${field.label} baris ${row.row}`
              return <td key={field.key}>{field.key === 'status'
                ? <select aria-label={label} aria-invalid={highlighted || undefined} disabled={locked || row.skipped} value={row.status} onChange={e => edit(index, { status: e.target.value })} className={inputClass}>{!STATUS_OPTIONS.some(option => option.value === row.status) && <option value={row.status}>{row.status} (perlu diperbaiki)</option>}{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : <input type="text" aria-label={label} aria-invalid={highlighted || undefined} disabled={locked || row.skipped} value={row[field.key]} onChange={e => edit(index, { [field.key]: e.target.value })} className={inputClass} />}</td>
            })}
            <td className="sticky right-40 z-10 bg-white min-w-[260px] whitespace-normal text-sm space-y-2 border-l">
              <span className={`inline-block rounded px-2 py-1 ${metadata?.system_status === 'existing' ? 'bg-green-100 text-green-800' : conflict ? 'bg-amber-100 text-amber-900' : 'bg-gray-100'}`}>{row.skipped ? 'Dilewati' : statusLabels[metadata?.system_status] || 'Belum divalidasi'}</span>
              {metadata?.system_record && <div><p>Nama sistem: {metadata.system_record.full_name || '—'}</p><p>NIK sistem: {metadata.system_record.nik || 'Belum tersedia'}</p><p>NIP sistem: {metadata.system_record.nip || 'Belum tersedia'}</p></div>}
              {metadata?.system_status === 'ambiguous' && <p>Tidak ada koreksi otomatis. Periksa identitas yang tepat dari sumber asli.</p>}
              {corrected !== row && <button type="button" className="btn-outline" disabled={locked || row.skipped} onClick={() => edit(index, corrected)}>Gunakan data sistem</button>}
              {history?.has_certificates === true && history.count > 0
                ? <div><p>{history.count} sertifikat tercatat</p><ul className="list-disc pl-4">{(Array.isArray(history.events) ? history.events : []).map((event, i) => <li key={`${event.id}-${i}`}>{event.title}</li>)}</ul></div>
                : <p>Belum ada riwayat sertifikat{!metadata && ' (validasi ulang untuk memeriksa)'}</p>}
            </td>
            <td className="sticky right-0 z-10 bg-white min-w-[160px] w-40"><button type="button" disabled={locked} className="btn-outline" onClick={() => edit(index, { skipped: !row.skipped })}>{row.skipped ? 'Pulihkan baris' : 'Lewati baris'}</button></td>
          </tr>
        })}</tbody></table></div>}
        {draft.rows.length > 0 && <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={locked || draftPage.current === 0} onClick={() => setPage(draftPage.current - 1)} className="btn-outline">Sebelumnya</button><span>Halaman {draftPage.current + 1} / {draftPage.pages} · 25 baris per halaman. Seluruh baris aktif tetap disimpan.</span><button type="button" disabled={locked || draftPage.current + 1 >= draftPage.pages} onClick={() => setPage(draftPage.current + 1)} className="btn-outline">Berikutnya</button></div>}
        <button type="button" disabled={Boolean(busy) || !activeCount || activeCount > 5000} onClick={() => preview(false)} className="btn-outline">{busy === 'preview' ? 'Memvalidasi perubahan...' : 'Validasi ulang perubahan'}</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={Boolean(busy) || !validCurrent} checked={draft.confirmed} onChange={e => updateDraft({ ...draftRef.current, confirmed: e.target.checked })} /> Saya telah memeriksa data peserta dan kehadiran yang sudah divalidasi; hanya baris aktif akan disimpan, tanpa membuat sertifikat.</label>
        <button type="button" disabled={Boolean(busy) || !canApplyAttendance(draft)} onClick={apply} className="btn-primary">{busy === 'apply' ? 'Menyimpan...' : '2. Konfirmasi dan simpan absensi yang ditinjau'}</button>
      </section>}
    </div>
  </ModalForm>
}
