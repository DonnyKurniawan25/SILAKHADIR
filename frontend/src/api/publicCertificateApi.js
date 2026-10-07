import axios from 'axios'
import { API_URL } from './axios'
import { certificateSearchParams, certificateDownloadUrl, certificateFilename, saveCertificateBlob } from './publicCertificateHelpers.mjs'

// Anonymous requests must not trigger an expired staff session's refresh/login flow.
const publicApi = axios.create({ baseURL: API_URL })
export const checkPublicCertificate = (identity, eventId) => publicApi.get('/public/certificates/check/', { params: certificateSearchParams(identity, eventId) })
export const verifyPublicCertificate = token => publicApi.get(`/public/certificates/verify/${encodeURIComponent(token)}/`)

export async function downloadPublicCertificate(certificate) {
  const url = certificateDownloadUrl(certificate, API_URL)
  if (!url) throw new Error('File sertifikat belum tersedia untuk diunduh.')
  const { data } = await publicApi.get(url, { responseType: 'blob' })
  if (!data.size || await data.slice(0, 5).text() !== '%PDF-') throw new Error('File PDF tidak tersedia. Silakan coba kembali atau hubungi penyelenggara.')
  saveCertificateBlob(data, certificateFilename(certificate))
}
