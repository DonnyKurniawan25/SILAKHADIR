import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import ModalForm from '../../components/ModalForm'
import { downloadAttendanceXlsx, importAttendanceXlsx } from '../../api/finalImportApi'
import { validateFiles, importError } from '../../utils/importWorkflow.mjs'

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
        setConfirmed(false); setResult(null)
        setError(`Impor tidak dapat diselesaikan: ${data.errors.map((item) => `baris ${item.row}: ${item.message}`).join('; ')}`)
        onImported?.(); return
      }
      if (data.dry_run !== false) throw new Error('Server belum mengonfirmasi penerapan absensi. Periksa data sebelum mencoba kembali.')
      setResult(null); setFile(null); setConfirmed(false)
      onImported?.(); onClose?.()
      Swal.fire({ icon: 'success', title: 'Absensi berhasil diimpor', text: `${data.created ?? 0} ditambahkan, ${data.updated ?? 0} diperbarui.` })
    } catch (err) { if (version === requestVersion.current) { setConfirmed(false); setResult(null); setError(importError(err, err.message || 'Gagal menerapkan absensi. Buat pratinjau ulang.')) } }
    finally { if (version === requestVersion.current) setBusy('') }
  }
  const rows = Array.isArray(result?.rows) ? result.rows : []
  const rowCount = Array.isArray(result?.rows) ? result.rows.length : result?.rows
  return <ModalForm open={open} onClose={() => { if (!busy) onClose?.() }} title="Unggah Absensi Excel (.xlsx)" maxWidth="max-w-4xl">
    <div className="space-y-4">
      <p className="text-sm text-ink-600">Gunakan template resmi absensi dan simpan sebagai .xlsx (bukan CSV atau .xls). Simpan NIK/NIP sebagai teks agar angka tidak berubah atau kehilangan nol di awal. Periksa hasil validasi sebelum menerapkan kehadiran.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => download('template')} className="btn-outline">{busy === 'template' ? 'Mengunduh...' : 'Unduh template absensi .xlsx'}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => download('export')} className="btn-outline">{busy === 'export' ? 'Mengunduh...' : 'Ekspor absensi .xlsx'}</button>
      </div>
      <label className="label">Berkas absensi<input type="file" disabled={Boolean(busy)} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pick} className="input mt-1" /><span className="block text-xs text-ink-500 mt-1">Maksimal 5 MB. {file && `Dipilih: ${file.name}`}</span></label>
      <button type="button" disabled={Boolean(busy) || !file} onClick={preview} className="btn-outline">{busy === 'preview' ? 'Memvalidasi...' : '1. Validasi dan pratinjau (belum menyimpan)'}</button>
      {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{error}</p>}
      {result && <section className="space-y-3">
        <h4 className="font-semibold">Hasil pratinjau absensi</h4>
        <p className="text-sm">Baris: {rowCount ?? '-'} · Baru: {result.created ?? 0} · Diperbarui: {result.updated ?? 0} · Kesalahan: {result.errors?.length ?? 0}. Belum ada perubahan yang disimpan.</p>
        {result.errors?.length > 0 && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800 text-sm"><p className="font-semibold">Perbaiki semua kesalahan pada Excel, pilih ulang berkas, lalu validasi kembali.</p><ul className="list-disc pl-5 max-h-60 overflow-auto">{result.errors.map((item, i) => <li key={i}>Baris {item.row}: {item.message}</li>)}</ul></div>}
        {rows.length > 0 && <div className="max-h-64 overflow-auto border rounded"><table className="table-base"><thead><tr><th>Baris</th><th>Isi / hasil pemeriksaan</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i}><td>{row?.row ?? i + 1}</td><td className="whitespace-pre-wrap text-xs">{typeof row === 'object' ? Object.entries(row).filter(([key]) => key !== 'row').map(([key, value]) => `${({ full_name: 'Nama', nik: 'NIK', nip: 'NIP', action: 'Tindakan', attendance_status: 'Kehadiran', status: 'Status', message: 'Keterangan' })[key] || key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ') : String(row)}</td></tr>)}</tbody></table></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={Boolean(busy) || Boolean(result.errors?.length)} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Saya sudah memeriksa data absensi yang akan ditambahkan/diperbarui.</label>
        <button type="button" disabled={Boolean(busy) || !confirmed || Boolean(result.errors?.length)} onClick={apply} className="btn-primary">{busy === 'apply' ? 'Menerapkan...' : '2. Konfirmasi dan terapkan absensi'}</button>
      </section>}
    </div>
  </ModalForm>
}
