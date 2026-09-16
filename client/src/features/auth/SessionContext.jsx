import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'

const SessionContext = createContext(null)

// Who is signed in, resolved once from the server on load. The session cookie
// is httpOnly, so this is the only way the UI can know.
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('checking') // checking | ready | offline

  const refresh = useCallback(async () => {
    try { const data = await api.get('/auth/session'); setUser(data.user); setStatus('ready') } catch { setStatus('offline') }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const value = useMemo(() => ({
    user, status, refresh, setUser,
    async login(email, password) { const data = await api.post('/auth/login', { email, password }); setUser(data.user); return data.user },
    async logout() { try { await api.del('/auth/session') } finally { setUser(null) } },
  }), [user, status, refresh])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)
