export function parsePageGroups(text) {
  if (!text.trim()) throw new Error('Isi rentang halaman terlebih dahulu.')
  const groups = text.split(/[,;\n]/).map((part) => {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part)
    if (!match) throw new Error('Format rentang tidak valid. Contoh: 1-2, 3, 4-6.')
    const start = Number(match[1]), end = Number(match[2] || match[1])
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) throw new Error('Halaman harus bilangan bulat positif; akhir tidak boleh sebelum awal.')
    return { start, end }
  })
  const sorted = [...groups].sort((a, b) => a.start - b.start)
  if (sorted.some((group, i) => i > 0 && group.start <= sorted[i - 1].end)) throw new Error('Rentang halaman tidak boleh tumpang tindih.')
  return groups
}

export function validateFiles(files, kind) {
  if (!files.length) return 'Pilih berkas terlebih dahulu.'
  const max = kind === 'pdf' ? 50 : 5
  const mime = kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const allowedTypes = kind === 'pdf'
    ? [mime, 'application/octet-stream', 'application/x-pdf']
    : [mime, 'application/octet-stream', 'application/zip', 'application/x-zip-compressed']
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(`.${kind}`) || (file.type && !allowedTypes.includes(file.type))) return `Berkas ${file.name} harus berformat ${kind.toUpperCase()}.`
    if (!file.size || file.size > max * 1024 * 1024) return `Berkas ${file.name} kosong atau melebihi batas ${max} MB.`
  }
  if (files.length > 100 || files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) return 'Maksimal 100 berkas dengan total ukuran 50 MB per impor.'
  return ''
}

export function validateAssignments(items, participants) {
  const allowed = new Set(participants.map((p) => String(p.id)))
  const selected = items.filter((item) => item.participant_id !== '' && item.participant_id != null)
  if (!selected.length) return 'Pilih sedikitnya satu peserta hadir. Berkas tanpa peserta akan dilewati.'
  const seen = new Set()
  for (const item of selected) {
    const id = String(item.participant_id)
    if (!allowed.has(id)) return 'Peserta tidak valid. Pilih dari daftar peserta hadir yang diberikan server.'
    if (seen.has(id)) return 'Satu peserta dipilih untuk beberapa berkas. Perbaiki pemetaan sebelum menerapkan.'
    seen.add(id)
  }
  return ''
}

const FIELD_LABELS = { nik: 'NIK', nip: 'NIP', full_name: 'Nama Lengkap', institution: 'Instansi', position: 'Jabatan', phone: 'No HP', email: 'Email', status: 'Status', file: 'Berkas', non_field_errors: 'Validasi' }

export function attendanceValidationIssues(data) {
  if (!Array.isArray(data?.errors)) return []
  return data.errors.flatMap((issue) => {
    const messages = Array.isArray(issue?.message) ? issue.message : [issue?.message]
    return messages.filter((message) => typeof message === 'string' && message.trim()).map((message) => ({
      row: issue.row ?? '-',
      column: typeof issue.column === 'string' ? issue.column : '',
      message,
      hint: typeof issue.hint === 'string' ? issue.hint : '',
    }))
  })
}

export function importError(error, fallback = 'Permintaan tidak dapat diproses. Coba kembali.') {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.message === 'string') return data.message
  const issues = attendanceValidationIssues(data)
  if (issues.length) return `Ada ${issues.length} kesalahan validasi. Belum ada data yang disimpan. Lihat rincian baris, kolom, dan cara memperbaiki di bawah.`
  if (data && typeof data === 'object' && !(typeof Blob !== 'undefined' && data instanceof Blob)) {
    const messages = Object.entries(FIELD_LABELS).flatMap(([field, label]) => {
      const values = Array.isArray(data[field]) ? data[field] : [data[field]]
      return values.filter((value) => typeof value === 'string').map((value) => `${label}: ${value}`)
    })
    if (messages.length) return messages.join(' ')
  }
  if (error?.response?.status === 401) return 'Sesi masuk berakhir. Silakan masuk kembali.'
  if (error?.response?.status === 413) return 'Berkas melebihi batas ukuran upload. Gunakan berkas yang lebih kecil.'
  return fallback
}
