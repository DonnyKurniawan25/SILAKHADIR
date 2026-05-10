import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchAppSetting } from '../api/authApi'

const BrandingContext = createContext(null)

function applyFavicon(url) {
  if (!url) return
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  // Cache-bust agar favicon langsung berubah saat admin ganti logo
  const bust = url.includes('?') ? '&' : '?'
  link.href = `${url}${bust}t=${Date.now()}`
}

function applyTitle(appName, tagline) {
  if (appName) {
    document.title = tagline ? `${appName} - ${tagline}` : appName
  }
}

function applyColors(primary, secondary) {
  const root = document.documentElement
  if (primary) root.style.setProperty('--brand', primary)
  if (secondary) root.style.setProperty('--gold', secondary)
}

export function BrandingProvider({ children }) {
  const [setting, setSetting] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await fetchAppSetting()
      setSetting(data)
      if (data.logo_url) applyFavicon(data.logo_url)
      applyTitle(data.app_name, data.tagline)
      applyColors(data.primary_color, data.secondary_color)
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <BrandingContext.Provider value={{ setting, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  )
}

export const useBranding = () => useContext(BrandingContext) || { setting: null, loading: true, refresh: () => {} }
