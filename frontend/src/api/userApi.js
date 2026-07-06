import api from './axios'

export const listUsers = (params) => api.get('/auth/users/', { params })
export const getUser = (id) => api.get(`/auth/users/${id}/`)
export const createUser = (data) => api.post('/auth/users/', data)
export const updateUser = (id, data) => api.put(`/auth/users/${id}/`, data)
export const deleteUser = (id) => api.delete(`/auth/users/${id}/`)
export const changeUserPassword = (id, password) => api.post(`/auth/users/${id}/change-password/`, { password })
