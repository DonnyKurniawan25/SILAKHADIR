import { createContext, useContext, useEffect, useState } from 'react'
import { fetchMe, login as loginApi, logout as logoutApi } from '../api/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('silakhadir_access')
    if (!token) {
      setLoading(false)
      return
    }
    fetchMe()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('silakhadir_access')
        localStorage.removeItem('silakhadir_refresh')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password, captcha = {}) => {
    const { data } = await loginApi(username, password, captcha)
    localStorage.setItem('silakhadir_access', data.access)
    localStorage.setItem('silakhadir_refresh', data.refresh)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await logoutApi(localStorage.getItem('silakhadir_refresh'))
    } catch {}
    localStorage.removeItem('silakhadir_access')
    localStorage.removeItem('silakhadir_refresh')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
