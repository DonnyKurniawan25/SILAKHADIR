import api from './axios'

export const login = (username, password, { captchaToken, captchaAnswer } = {}) =>
  api.post('/auth/login/', {
    username,
    password,
    captcha_token: captchaToken,
    captcha_answer: captchaAnswer,
  })

export const fetchMe = () => api.get('/auth/me/')

export const logout = (refresh) => api.post('/auth/logout/', { refresh })

export const fetchAppSetting = () => api.get('/settings/')
export const updateAppSetting = (form) =>
  api.put('/settings/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
