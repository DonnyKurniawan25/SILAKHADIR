import api from './axios'

export const fetchLatestNews = (limit = 5) =>
  api.get('/public/news/latest/', { params: { limit } })
