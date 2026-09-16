import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import { Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { useSession } from './SessionContext.jsx'

export default function LoginPage() {
  const { login } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  useEffect(() => { api.get('/auth/setup').then((d) => setSetupOpen(Boolean(d.available))).catch(() => {}) }, [])

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { await login(email, password); navigate(location.state?.from || '/', { replace: true }) }
    catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="eyebrow">The client gate</p><h2>Welcome back.</h2><p>Sign in with the account you were invited with.</p>
      <Field label="Email address" id="email"><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus /></Field>
      <Field label="Password" id="password"><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
      <Notice tone="error">{error}</Notice>
      <button className="button primary" disabled={busy || !email || !password}>{busy ? 'Opening…' : 'Enter the portal'} <span>→</span></button>
      <p className="aux"><Link to="/forgot-password">Forgotten your password?</Link>{setupOpen && <> · <Link to="/setup">First-run setup</Link></>}</p>
    </form>
  )
}
