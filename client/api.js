const tokenKey = 'revive-portal-session'

export const session = {
  get: () => sessionStorage.getItem(tokenKey),
  set: (token) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey),
}

export async function api(path, options = {}) {
  const headers = { ...options.headers }
  const token = session.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body) headers['Content-Type'] = 'application/json'
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}
