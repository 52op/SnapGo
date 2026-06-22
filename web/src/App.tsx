import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { getAppConfig, setToken, getToken, getMe, AppConfig } from './api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sources from './pages/Sources'
import Destinations from './pages/Destinations'
import StorageProviders from './pages/StorageProviders'
import Jobs from './pages/Jobs'
import Logs from './pages/Logs'
import Help from './pages/Help'
import Layout from './components/Layout'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    getAppConfig().then(cfg => {
      setConfig(cfg)
      const token = getToken()
      if (token) {
        return getMe().then(() => setAuthed(true)).catch(() => {
          setToken(null)
          if (cfg.auth_mode === 'sso') {
            window.location.href = `${cfg.sso_url}/login?redirect=${encodeURIComponent(window.location.origin + '/login')}`
          }
        })
      } else if (cfg.auth_mode === 'sso') {
        const params = new URLSearchParams(window.location.search)
        const ssoToken = params.get('token')
        if (ssoToken) {
          setToken(ssoToken)
          setAuthed(true)
          window.history.replaceState({}, '', '/')
        } else {
          window.location.href = `${cfg.sso_url}/login?redirect=${encodeURIComponent(window.location.origin + '/login')}`
          return
        }
      }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" tip="加载中..." /></div>
  }

  if (!authed && config?.auth_mode === 'sso') {
    return null
  }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!authed) return <Navigate to="/login" replace />
    return <>{children}</>
  }

  return (
    <Routes>
      <Route path="/login" element={
        authed ? <Navigate to="/" replace /> :
        config?.auth_mode === 'sso' ? null :
        <Login onLogin={() => setAuthed(true)} />
      } />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="sources" element={<Sources />} />
        <Route path="destinations" element={<Destinations />} />
        <Route path="providers" element={<StorageProviders />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="logs" element={<Logs />} />
        <Route path="help" element={<Help />} />
      </Route>
    </Routes>
  )
}
