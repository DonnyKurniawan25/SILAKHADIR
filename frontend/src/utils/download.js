import api from '../api/axios'

/** Download authenticated URL as blob, lalu trigger simpan file. */
export async function downloadAuthed(url, filename) {
  const relative = url.replace(api.defaults.baseURL, '')
  const { data, headers } = await api.get(relative, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename || inferFilename(headers, 'download')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

function inferFilename(headers, fallback) {
  const disp = headers?.['content-disposition'] || ''
  const m = /filename="?([^"]+)"?/i.exec(disp)
  return m ? m[1] : fallback
}
