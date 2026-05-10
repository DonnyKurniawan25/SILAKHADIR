import api, { API_URL } from './axios'

export const attendanceReport = (eventId) =>
  api.get(`/events/${eventId}/reports/attendance/`)

export const certificateReport = (eventId) =>
  api.get(`/events/${eventId}/reports/certificates/`)

export const reportExcelUrl = (eventId) =>
  `${API_URL}/events/${eventId}/reports/export-excel/`

export const reportPdfUrl = (eventId) =>
  `${API_URL}/events/${eventId}/reports/export-pdf/`
