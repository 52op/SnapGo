const API_BASE = '/api'

let authToken: string | null = localStorage.getItem('snapgo_token')

export function setToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('snapgo_token', token)
  } else {
    localStorage.removeItem('snapgo_token')
  }
}

export function getToken() {
  return authToken
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok && data.code === 401) {
    setToken(null)
    window.location.href = '/login'
    throw new Error(data.message)
  }
  return data
}

export interface AppConfig {
  auth_mode: 'standalone' | 'sso'
  sso_url: string
}

export function getAppConfig(): Promise<AppConfig> {
  return request('/app-config').then(r => r.data)
}

export function login(username: string, password: string) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function getMe() {
  return request('/auth/me').then(r => r.data)
}

export function getDashboardStats() {
  return request('/dashboard/stats').then(r => r.data)
}

export function listSources() {
  return request('/sources').then(r => r.data)
}

export function getSource(id: number) {
  return request(`/sources/${id}`).then(r => r.data)
}

export function createSource(data: any) {
  return request('/sources', { method: 'POST', body: JSON.stringify(data) })
}

export function updateSource(id: number, data: any) {
  return request(`/sources/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteSource(id: number) {
  return request(`/sources/${id}`, { method: 'DELETE' })
}

export function listDestinations() {
  return request('/destinations').then(r => r.data)
}

export function getDestination(id: number) {
  return request(`/destinations/${id}`).then(r => r.data)
}

export function createDestination(data: any) {
  return request('/destinations', { method: 'POST', body: JSON.stringify(data) })
}

export function updateDestination(id: number, data: any) {
  return request(`/destinations/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteDestination(id: number) {
  return request(`/destinations/${id}`, { method: 'DELETE' })
}

export function testDestination(id: number) {
  return request(`/destinations/${id}/test`, { method: 'POST' })
}

export function browsePath(path: string) {
  return request(`/browse?path=${encodeURIComponent(path)}`).then(r => r.data)
}

export function listProviders() {
  return request('/providers').then(r => r.data)
}

export function getProvider(id: number) {
  return request(`/providers/${id}`).then(r => r.data)
}

export function createProvider(data: any) {
  return request('/providers', { method: 'POST', body: JSON.stringify(data) })
}

export function updateProvider(id: number, data: any) {
  return request(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteProvider(id: number) {
  return request(`/providers/${id}`, { method: 'DELETE' })
}

export function testProvider(data: any) {
  return request('/providers/test', { method: 'POST', body: JSON.stringify(data) })
}

export function listJobs() {
  return request('/jobs').then(r => r.data)
}

export function getJob(id: number) {
  return request(`/jobs/${id}`).then(r => r.data)
}

export function createJob(data: any) {
  return request('/jobs', { method: 'POST', body: JSON.stringify(data) })
}

export function updateJob(id: number, data: any) {
  return request(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteJob(id: number) {
  return request(`/jobs/${id}`, { method: 'DELETE' })
}

export function runJob(id: number) {
  return request(`/jobs/${id}/run`, { method: 'POST' })
}

export function listLogs(params?: { job_id?: number; page?: number; page_size?: number }) {
  const q = new URLSearchParams()
  if (params?.job_id) q.set('job_id', String(params.job_id))
  if (params?.page) q.set('page', String(params.page))
  if (params?.page_size) q.set('page_size', String(params.page_size))
  return request(`/logs?${q}`).then(r => r.data)
}

export function getLog(id: number) {
  return request(`/logs/${id}`).then(r => r.data)
}

export function deleteLog(id: number) {
  return request(`/logs/${id}`, { method: 'DELETE' })
}
