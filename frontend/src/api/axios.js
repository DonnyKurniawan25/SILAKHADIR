import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('silakhadir_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh token on 401
let isRefreshing = false
let queue = []
const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  queue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('silakhadir_refresh')
      if (!refresh) {
        localStorage.removeItem('silakhadir_access')
        return Promise.reject(error)
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }
      isRefreshing = true
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh })
        localStorage.setItem('silakhadir_access', data.access)
        if (data.refresh) localStorage.setItem('silakhadir_refresh', data.refresh)
        api.defaults.headers.Authorization = `Bearer ${data.access}`
        processQueue(null, data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch (e) {
        processQueue(e, null)
        localStorage.removeItem('silakhadir_access')
        localStorage.removeItem('silakhadir_refresh')
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default api
