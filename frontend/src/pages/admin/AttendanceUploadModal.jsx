import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import ModalForm from '../../components/ModalForm'
import { downloadAttendanceXlsx, importAttendanceXlsx } from '../../api/finalImportApi'
import { validateFiles, importError, attendanceValidationIssues } from '../../utils/importWorkflow.mjs'

export default function AttendanceUploadModal({ open, onClose, eventId, onImported }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const requestVersion = useRef(0)
  useEffect(() => {
    requestVersion.current += 1
    if (open) { setFile(null); setResult(null); setError(''); setConfirmed(false); setBusy('') }
    return () => { requestVersion.current += 1 }
  }, [open, eventId])

  const download = async (kind) => {
    setBusy(kind); setError('')
    try { await downloadAttendanceXlsx(eventId, kind) }
    catch (err) { setError(importError(err, 'Gagal mengunduh berkas Excel.')) }
    finally { setBusy('') }
  }
  const pick = (event) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    requestVersion.current += 1
    setResult(null); setConfirmed(false); setError('')
    const validation = validateFiles(picked ? [picked] : [], 'xlsx')
    if (validation) { setFile(null); setError(validation); return }
    setFile(picked)
  }
  const preview = async () => {
    const validation = validateFiles(file ? [file] : [], 'xlsx')
    if (validation) { setError(validation); return }
    setBusy('preview'); setError(''); setResult(null); setConfirmed(false)
    const version = ++requestVersion.current
    try {
      const { data } = await importAttendanceXlsx(eventId, file, true)
      if (version !== requestVersion.current) return
      if (data.dry_run !== true || !Array.isArray(data.errors)) throw new Error('Respons pratinjau absensi tidak lengkap. Impor belum dapat diterapkan.')
      setResult(data)
    } catch (err) {
      if (version !== requestVersion.current) return
      if (Array.isArray(err?.response?.data?.errors) && err.response.data.errors.length) setResult({ ...err.response.data, dry_run: true })
      setError(importError(err, err.message || 'Gagal memeriksa berkas absensi.'))
    } finally { if (version === requestVersion.current) setBusy('') }
  }
  const apply = async () => {
    if (!file || !result || result.dry_run !== true || result.errors?.length || !confirmed || busy) return
    setBusy('confirm')
    const version = requestVersion.current
    try {
      const { isConfirmed } = await Swal.fire({ icon: 'question', title: 'Terapkan absensi Excel?', text: `${result.created ?? 0} data baru dan ${result.updated ?? 0} data diperbarui. Data kehadiran mengikuti isi Excel yang ditinjau.`, showCancelButton: true, confirmButtonText: 'Ya, terapkan', cancelButtonText: 'Batal' })
      if (!isConfirmed || version !== requestVersion.current) return
      setBusy('apply'); setError('')
      const { data } = await importAttendanceXlsx(eventId, file, false)
      if (version !== requestVersion.current) return
      if (data.errors?.length) {
        // Invalidate approval even if the server finds new errors between preview and apply.
        setConfirmed(false); setResult({ ...data, dry_run: true })
        setError(importError({ response: { data } }, 'Impor tidak dapat diselesaikan. Buat pratinjau ulang.'))
        onImported?.(); return
      }
      if (data.dry_run !== false) throw new Error('Server belum mengonfirmasi penerapan absensi. Periksa data sebelum mencoba kembali.')
      setResult(null); setFile(null); setConfirmed(false)
      onImported?.(); onClose?.()
      Swal.fire({ icon: 'success', title: 'Absensi berhasil diimpor', text: `${data.created ?? 0} ditambahkan, ${data.updated ?? 0} diperbarui.` })
    } catch (err) {
      if (version === requestVersion.current) {
        setConfirmed(false)
        const data = err?.response?.data
        setResult(Array.isArray(data?.errors) && data.errors.length ? { ...data, dry_run: true } : null)
        setError(importError(err, 'Gagal menerapkan absensi. Buat pratinjau ulang.'))
      }
    }
    finally { if (version === requestVersion.current) setBusy('') }
  }
  const rows = Array.isArray(result?.rows) ? result.rows : []
  const rowCount = Array.isArray(result?.rows) ? result.rows.length : result?.rows
  const issues = attendanceValidationIssues(result)
  const hasErrors = Boolean(result?.errors?.length)
  const errorRows = new Set(issues.map((issue) => String(issue.row)))
  const nameByRow = new Map(rows.map((row) => [String(row.row), row.full_name]))
  return <ModalForm open={open} onClose={() => { if (!busy) onClose?.() }} title="Unggah Absensi Excel (.xlsx)" maxWidth="max-w-4xl">
    <div className="space-y-4">
      <div className="text-sm text-ink-600 space-y-2">
        <p><strong>Wajib: Nama Lengkap dan salah satu NIP atau NIK.</strong> ASN boleh mengisi Nama + NIP tanpa NIK. Non-ASN mengisi Nama + NIK tanpa NIP. Kolom lainnya boleh kosong; Status kosong dianggap hadir.</p>
        <p>Jika NIK kosong, sistem mencari NIK yang sudah dikenal berdasarkan NIP yang cocok. Jika belum ada, data tetap disimpan dengan NIP saja, tanpa NIK buatan.</p>
        <p>Gunakan .xlsx (bukan CSV atau .xls). <strong>Simpan NIP/NIK sebagai Text sebelum menempel data.</strong> Jika sudah berubah menjadi angka ilmiah seperti 1.98E+17, ubah format ke Text lalu tempel ulang nomor lengkap dari sumber asli. Mengubah format saja tidak mengembalikan digit yang hilang.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => download('template')} className="btn-outline">{busy === 'template' ? 'Mengunduh...' : 'Unduh template absensi .xlsx'}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => download('export')} className="btn-outline">{busy === 'export' ? 'Mengunduh...' : 'Ekspor absensi .xlsx'}</button>
      </div>
      <label className="label">Berkas absensi<input type="file" disabled={Boolean(busy)} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pick} className="input mt-1" /><span className="block text-xs text-ink-500 mt-1">Maksimal 5 MB. {file && `Dipilih: ${file.name}`}</span></label>
      <button type="button" disabled={Boolean(busy) || !file} onClick={preview} className="btn-outline">{busy === 'preview' ? 'Memvalidasi...' : '1. Validasi dan pratinjau (belum menyimpan)'}</button>
      {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{error}</p>}
      {result && <section className="space-y-3">
        <h4 className="font-semibold">Hasil pratinjau absensi</h4>
        <p className="text-sm">Baris: {rowCount ?? '-'} · Baru: {result.created ?? 0} · Diperbarui: {result.updated ?? 0} · Kesalahan: {issues.length}. Belum ada perubahan yang disimpan.</p>
        {hasErrors && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800 text-sm space-y-2">
          <p className="font-semibold">Import belum disimpan. Perbaiki baris berikut, pilih ulang berkas, lalu validasi kembali.</p>
          <div className="max-h-80 overflow-auto"><table className="table-base"><thead><tr><th>Baris Excel</th><th>Nama</th><th>Kolom</th><th>Penyebab</th><th>Cara memperbaiki</th></tr></thead><tbody>{issues.map((item, i) => <tr key={i}><td>{item.row}</td><td>{nameByRow.get(String(item.row)) || '—'}</td><td>{item.column || 'Validasi'}</td><td className="whitespace-normal">{item.message}</td><td className="whitespace-normal">{item.hint || 'Periksa nilai pada baris dan kolom tersebut sesuai petunjuk template.'}</td></tr>)}</tbody></table></div>
        </div>}
        {rows.length > 0 && <div className="max-h-64 overflow-auto border rounded"><table className="table-base"><thead><tr><th>Baris</th><th>Nama Lengkap</th><th>NIP</th><th>NIK</th><th>Kehadiran</th><th>Hasil</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.row ?? i} className={errorRows.has(String(row.row)) ? 'bg-red-50' : ''}><td>{row.row ?? i + 1}</td><td>{row.full_name || '—'}</td><td>{row.nip || '—'}</td><td>{row.nik || 'Belum tersedia'}</td><td>{({ hadir: 'Hadir', tidak_hadir: 'Tidak hadir' })[row.status] || row.status || '—'}</td><td>{({ created: 'Data baru', updated: 'Diperbarui' })[row.action] || 'Perlu diperbaiki'}</td></tr>)}</tbody></table></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={Boolean(busy) || Boolean(result.errors?.length)} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Saya sudah memeriksa data absensi yang akan ditambahkan/diperbarui.</label>
        <button type="button" disabled={Boolean(busy) || !confirmed || Boolean(result.errors?.length)} onClick={apply} className="btn-primary">{busy === 'apply' ? 'Menerapkan...' : '2. Konfirmasi dan terapkan absensi'}</button>
      </section>}
    </div>
  </ModalForm>
}
