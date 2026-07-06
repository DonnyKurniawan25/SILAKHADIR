import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Pencil, Trash2, Key, Search, ShieldAlert,
  CheckCircle, XCircle, ArrowLeft, Loader2
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import Swal from 'sweetalert2'
import { listUsers, createUser, updateUser, deleteUser, changeUserPassword } from '../../api/userApi'

export default function UserList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      const { data } = await listUsers(params)
      setUsers(data.results || data)
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal Memuat User' })
    }
    setLoading(false)
  }, [search, roleFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleDelete = async (u) => {
    const res = await Swal.fire({
      title: 'Hapus Pengguna?',
      text: `Akun ${u.first_name || u.username} akan dihapus permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d32f2f',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    })
    if (!res.isConfirmed) return

    try {
      await deleteUser(u.id)
      Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1200, showConfirmButton: false })
      loadUsers()
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal Menghapus' })
    }
  }

  const handleEdit = (u) => {
    setSelectedUser(u)
    setShowModal(true)
  }

  const handlePasswordChangeClick = (u) => {
    setSelectedUser(u)
    setShowPasswordModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <div className="eyebrow">Manajemen Sistem</div>
          <h1 className="section-title mt-1">Daftar Pengguna</h1>
          <p className="text-sm text-ink-500 mt-1">
            Kelola akun, ubah kata sandi, dan atur peran hak akses pegawai.
          </p>
        </div>
        <button
          onClick={() => { setSelectedUser(null); setShowModal(true) }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> Tambah Pengguna
        </button>
      </div>

      {/* Filter and search */}
      <div className="card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            className="input pl-10"
            placeholder="Cari berdasarkan nama, username, NIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-48"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Semua Peran</option>
          <option value="superadmin">Super Admin</option>
          <option value="admin">Admin Kegiatan</option>
          <option value="operator">Operator / Pegawai</option>
        </select>
      </div>

      {/* User Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-10">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-ink-500">Tidak ditemukan data pengguna.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto shadow-card">
          <table className="table-base">
            <thead>
              <tr>
                <th>No</th>
                <th>Pengguna</th>
                <th>NIP</th>
                <th>Jabatan / Instansi</th>
                <th>Kontak</th>
                <th>Peran</th>
                <th className="text-center">Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id}>
                  <td className="text-center text-ink-500">{idx + 1}</td>
                  <td>
                    <div className="font-semibold text-ink-900">{u.first_name || u.username}</div>
                    <div className="text-xs text-ink-500 font-mono">@{u.username}</div>
                  </td>
                  <td className="font-mono text-sm">{u.nip || '-'}</td>
                  <td>
                    <div className="text-xs text-ink-900">{u.jabatan || '-'}</div>
                    <div className="text-[10px] text-ink-400">{u.institution || '-'}</div>
                  </td>
                  <td>
                    <div className="text-xs text-ink-900">{u.email || '-'}</div>
                    <div className="text-xs text-ink-500 font-mono">{u.phone || '-'}</div>
                  </td>
                  <td>
                    <span className={`badge ${
                      u.role === 'superadmin' ? 'badge-red' : u.role === 'admin' ? 'badge-blue' : 'badge-gray'
                    }`}>
                      {u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Pegawai'}
                    </span>
                  </td>
                  <td className="text-center">
                    {u.is_active ? (
                      <span className="badge badge-green inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Aktif
                      </span>
                    ) : (
                      <span className="badge badge-gray inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Nonaktif
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEdit(u)}
                        title="Edit Profil"
                        className="btn text-xs !p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handlePasswordChangeClick(u)}
                        title="Ganti Password"
                        className="btn text-xs !p-1.5 bg-slate-100 text-gold-700 hover:bg-slate-200"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        title="Hapus Pengguna"
                        className="btn text-xs !p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create User Modal */}
      {showModal && (
        <UserFormModal
          user={selectedUser}
          onSaved={() => { setShowModal(false); loadUsers() }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          user={selectedUser}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  )
}

function UserFormModal({ user, onSaved, onClose }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: user ? {
      username: user.username,
      first_name: user.first_name,
      email: user.email,
      nip: user.nip || '',
      jabatan: user.jabatan || '',
      phone: user.phone || '',
      institution: user.institution || '',
      role: user.role || 'operator',
      is_active: user.is_active,
    } : {
      username: '',
      first_name: '',
      email: '',
      nip: '',
      jabatan: '',
      phone: '',
      institution: 'Dinas Kependudukan dan Pencatatan Sipil',
      role: 'operator',
      password: '',
      is_active: true,
    }
  })

  const onSubmit = async (data) => {
    try {
      if (user) {
        // Edit
        await updateUser(user.id, data)
        Swal.fire({ icon: 'success', title: 'Profil Diperbarui', timer: 1200, showConfirmButton: false })
      } else {
        // Create
        await createUser(data)
        Swal.fire({ icon: 'success', title: 'Pengguna Ditambahkan', timer: 1200, showConfirmButton: false })
      }
      onSaved()
    } catch (e) {
      const resp = e?.response?.data || {}
      const msg = resp.detail || Object.values(resp)?.[0]?.[0] || 'Gagal menyimpan data pengguna.'
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: String(msg) })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-ink-900">
            {user ? 'Perbarui Profil Pengguna' : 'Tambah Pengguna Baru'}
          </h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-lg font-bold">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div>
              <label className="label">Nama Lengkap *</label>
              <input
                className="input"
                placeholder="Nama beserta gelar..."
                {...register('first_name', { required: 'Nama lengkap wajib diisi' })}
              />
              {errors.first_name && <p className="text-xs text-rose-600 mt-1">{errors.first_name.message}</p>}
            </div>

            {/* Username */}
            <div>
              <label className="label">Username / NIP *</label>
              <input
                className="input"
                placeholder="Digunakan untuk login..."
                {...register('username', { required: 'Username wajib diisi' })}
              />
              {errors.username && <p className="text-xs text-rose-600 mt-1">{errors.username.message}</p>}
            </div>

            {/* NIP */}
            <div>
              <label className="label">NIP ASN</label>
              <input
                className="input"
                placeholder="18 digit NIP..."
                {...register('nip')}
              />
            </div>

            {/* Jabatan */}
            <div>
              <label className="label">Jabatan ASN</label>
              <input
                className="input"
                placeholder="Pranata Komputer, Pengadministrasi..."
                {...register('jabatan')}
              />
            </div>

            {/* Email */}
            <div>
              <label className="label">Surel / Email</label>
              <input
                type="email"
                className="input"
                placeholder="nama@domain.com..."
                {...register('email')}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="label">Nomor HP</label>
              <input
                className="input"
                placeholder="e.g. 08123456789..."
                {...register('phone')}
              />
            </div>

            {/* Instansi */}
            <div className="md:col-span-2">
              <label className="label">Instansi / Unit Kerja</label>
              <input
                className="input"
                placeholder="Nama dinas / instansi..."
                {...register('institution')}
              />
            </div>

            {/* Peran / Role */}
            <div>
              <label className="label">Hak Akses / Peran *</label>
              <select className="input" {...register('role', { required: true })}>
                <option value="operator">Operator / Pegawai</option>
                <option value="admin">Admin Kegiatan</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>

            {/* Active Status */}
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  {...register('is_active')}
                />
                <span className="text-sm font-semibold text-ink-700">Akun Aktif</span>
              </label>
            </div>

            {/* Password (Hanya saat create) */}
            {!user && (
              <div className="md:col-span-2">
                <label className="label">Kata Sandi Baru *</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Minimal 6 karakter..."
                  {...register('password', {
                    required: 'Password wajib diisi untuk pengguna baru',
                    minLength: { value: 6, message: 'Password minimal 6 karakter' }
                  })}
                />
                {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="btn-outline flex-1">
              Batal
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Menyimpan...' : user ? 'Perbarui' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChangePasswordModal({ user, onClose }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { password: '' }
  })

  const onSubmit = async (data) => {
    try {
      await changeUserPassword(user.id, data.password)
      Swal.fire({
        icon: 'success',
        title: 'Password Diperbarui',
        text: `Kata sandi untuk ${user.first_name || user.username} berhasil diubah.`,
        timer: 2000,
        showConfirmButton: false
      })
      onClose()
    } catch (e) {
      const resp = e?.response?.data || {}
      const msg = resp.detail || 'Gagal memperbarui kata sandi.'
      Swal.fire({ icon: 'error', title: 'Gagal Mengubah', text: String(msg) })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-ink-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-gold-600" /> Ubah Sandi Pengguna
          </h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-lg font-bold">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            Mengubah kata sandi untuk pengguna: <strong>{user?.first_name || user?.username} (NIP: {user?.nip || '-'})</strong>.
          </div>

          <div>
            <label className="label">Kata Sandi Baru *</label>
            <input
              type="password"
              className="input"
              placeholder="Masukkan minimal 6 karakter..."
              {...register('password', {
                required: 'Password baru wajib diisi',
                minLength: { value: 6, message: 'Password minimal 6 karakter' }
              })}
            />
            {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>}
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="btn-outline flex-1">
              Batal
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Menyimpan...' : 'Perbarui Sandi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
