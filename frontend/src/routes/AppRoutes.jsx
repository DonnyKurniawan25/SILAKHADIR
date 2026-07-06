import { Routes, Route, Navigate } from 'react-router-dom'

import PublicLayout from '../layouts/PublicLayout'
import AdminLayout from '../layouts/AdminLayout'
import ProtectedRoute from '../components/ProtectedRoute'

import LandingPage from '../pages/public/LandingPage'
import AttendanceForm from '../pages/public/AttendanceForm'
import AttendanceSuccess from '../pages/public/AttendanceSuccess'
import CheckCertificate from '../pages/public/CheckCertificate'
import VerifyCertificate from '../pages/public/VerifyCertificate'

import Login from '../pages/auth/Login'
import Dashboard from '../pages/admin/Dashboard'
import EventList from '../pages/admin/EventList'
import EventDetail from '../pages/admin/EventDetail'
import QrPrintPage from '../pages/admin/QrPrintPage'
import CertificateList from '../pages/admin/CertificateList'
import Reports from '../pages/admin/Reports'
import Settings from '../pages/admin/Settings'
import KinerjaPeriodeList from '../pages/admin/KinerjaPeriodeList'
import KinerjaForm from '../pages/admin/KinerjaForm'
import KinerjaDetail from '../pages/admin/KinerjaDetail'
import KinerjaLaporan from '../pages/admin/KinerjaLaporan'
import UserList from '../pages/admin/UserList'
import Profile from '../pages/admin/Profile'

import KinerjaFormPublic from '../pages/public/KinerjaFormPublic'

import KinerjaLaporanPegawaiDetail from '../pages/admin/KinerjaLaporanPegawaiDetail'

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="/cek-sertifikat" element={<CheckCertificate />} />
        <Route path="/verifikasi/:token" element={<VerifyCertificate />} />
        <Route path="/absensi/:slug" element={<AttendanceForm />} />
        <Route path="/absensi/:slug/sukses" element={<AttendanceSuccess />} />
        <Route path="/kinerja/:slug" element={<KinerjaFormPublic />} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={<Login />} />

      {/* Admin-only print pages (tanpa layout sidebar) */}
      <Route
        path="/admin/kegiatan/:id/qr-print"
        element={
          <ProtectedRoute>
            <QrPrintPage />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="kegiatan" element={<EventList />} />
        <Route path="kegiatan/:id" element={<EventDetail />} />
        <Route path="sertifikat" element={<CertificateList />} />
        <Route path="laporan" element={<Reports />} />
        <Route path="kinerja" element={<KinerjaPeriodeList />} />
        <Route path="kinerja/buat" element={<KinerjaForm />} />
        <Route path="kinerja/:id" element={<KinerjaDetail />} />
        <Route path="kinerja/:id/laporan" element={<KinerjaLaporan />} />
        <Route path="kinerja/:id/laporan/:nip" element={<KinerjaLaporanPegawaiDetail />} />
        <Route
          path="pengguna"
          element={
            <ProtectedRoute roles={['admin', 'superadmin']}>
              <UserList />
            </ProtectedRoute>
          }
        />
        <Route
          path="pengaturan"
          element={
            <ProtectedRoute roles={['admin', 'superadmin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="profil" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
