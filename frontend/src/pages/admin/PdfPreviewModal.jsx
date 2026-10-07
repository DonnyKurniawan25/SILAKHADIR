import { useEffect, useState } from 'react'
import ModalForm from '../../components/ModalForm'
import { getAuthenticatedPdf } from '../../api/finalImportApi'
import { importError } from '../../utils/importWorkflow.mjs'

export default function PdfPreviewModal({ url, onClose }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true, objectUrl = ''
    setBlobUrl(''); setError('')
    if (url) getAuthenticatedPdf(url).then((value) => {
      objectUrl = value
      if (active) setBlobUrl(value)
      else URL.revokeObjectURL(value)
    }).catch((err) => { if (active) setError(importError(err, err.message || 'Pratinjau PDF gagal dimuat.')) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url])
  return <ModalForm open={Boolean(url)} onClose={onClose} title="Pratinjau PDF final" maxWidth="max-w-5xl">
    {error ? <p role="alert" className="text-red-700">{error}</p> : !blobUrl ? <p>Memuat PDF...</p> : <>
      <iframe title="Pratinjau sertifikat final" src={blobUrl} className="w-full h-[65vh] border rounded" />
      <a href={blobUrl} download="sertifikat-final.pdf" className="btn-outline mt-3">Unduh PDF final</a>
    </>}
  </ModalForm>
}
