import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import { LoadingBlock, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { useSession } from './SessionContext.jsx'

// First-run setup: creates the admin account when none exists yet. Needs the
// SETUP_TOKEN from the server environment; closed (404) once an admin exists.
export default function SetupPage() {
  const { setUser } = useSession()
  const navigate = useNavigate()
  const [state, setState] = useState('checking') // checking | open | closed
  const [form, setForm] = useState({ token: '', name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/auth/setup').then((d) => setState(d.available ? 'open' : 'closed')).catch(() => setState('closed')) }, [])
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(event) {
    event.preventDefault(); setError(''); setFields({})
    if (form.password !== form.confirm) return setFields({ confirm: 'The two passwords do not match.' })
    setBusy(true)
    try {
      const data = await api.post('/auth/setup', { token: form.token.trim(), name: form.name, email: form.email, password: form.password })
      setUser(data.user); navigate('/admin', { replace: true })
    } catch (requestError) { setError(requestError.message); setFields(requestError.fields || {}); if (requestError.status === 404) setState('closed') }
    finally { setBusy(false) }
  }

  if (state === 'checking') return <LoadingBlock text="Checking…" />
  if (state === 'closed') return (
    <div><p className="eyebrow">Setup</p><h2>Already set up.</h2><p>This portal has its admin account. <Link to="/login">Sign in</Link> instead.</p></div>
  )
  return (
    <form onSubmit={submit} noValidate>
      <p className="eyebrow">First run</p><h2>Create the admin account.</h2>
      <p>One time only. You need the setup token from the server's environment.</p>
      <Field label="Setup token" id="token" error={fields.token}><input id="token" type="password" value={form.token} onChange={set('token')} autoComplete="off" required autoFocus /></Field>
      <Field label="Your name" id="name" error={fields.name}><input id="name" value={form.name} onChange={set('name')} autoComplete="name" required /></Field>
      <Field label="Email address" id="email" error={fields.email}><input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></Field>
      <Field label="Password" id="password" hint="At least 12 characters." error={fields.password}><input id="password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" minLength={12} required /></Field>
      <Field label="Confirm password" id="confirm" error={fields.confirm}><input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required /></Field>
      <Notice tone="error">{error}</Notice>
      <button className="button primary" disabled={busy || !form.token || form.name.trim().length < 2 || !form.email || form.password.length < 12 || !form.confirm}>{busy ? 'Creating…' : 'Create admin and sign in'} <span>→</span></button>
    </form>
  )
}
