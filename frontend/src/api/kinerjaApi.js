import api from './axios'

// === Periode Kinerja ===
export const listPeriodes = (params) => api.get('/kinerja/periodes/', { params })
export const getPeriode = (id) => api.get(`/kinerja/periodes/${id}/`)
export const createPeriode = (data) => api.post('/kinerja/periodes/', data)
export const updatePeriode = (id, data) => api.put(`/kinerja/periodes/${id}/`, data)
export const deletePeriode = (id) => api.delete(`/kinerja/periodes/${id}/`)

// === Kinerja Harian ===
export const listKinerja = (params) => api.get('/kinerja/entries/', { params })
export const getKinerja = (id) => api.get(`/kinerja/entries/${id}/`)
export const createKinerja = (data) => api.post('/kinerja/entries/', data)
export const updateKinerja = (id, data) => api.put(`/kinerja/entries/${id}/`, data)
export const deleteKinerja = (id) => api.delete(`/kinerja/entries/${id}/`)

// === Laporan ===
export const getLaporan = (periodeId, params) =>
  api.get(`/kinerja/periodes/${periodeId}/laporan/`, { params })

export const exportLaporanUrl = (periodeId, nip) => {
  let url = `${api.defaults.baseURL}/kinerja/periodes/${periodeId}/export/`
  if (nip) url += `?nip=${nip}`
  return url
}

// === Public (Tanpa Login) ===
export const publicPeriodeInfo = (slug) => api.get(`/public/kinerja/${slug}/info/`)
export const submitPublicKinerja = (slug, data) => api.post(`/public/kinerja/${slug}/submit/`, data)
export const lookupPegawaiByNip = (nip) => api.get(`/public/kinerja/pegawai/${nip}/`)
