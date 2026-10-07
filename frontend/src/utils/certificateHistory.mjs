export function certificateHistoryLabel(history) {
  if (!history?.has_certificates || !Number.isInteger(history.count) || history.count <= 0) return ''
  return `Pernah menerima ${history.count} sertifikat`
}
