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

export function importError(error, fallback) {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.message === 'string') return data.message
  if (data && !(typeof Blob !== 'undefined' && data instanceof Blob)) return JSON.stringify(data)
  return fallback
}
