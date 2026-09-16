import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import { LoadingBlock, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { useSession } from './SessionContext.jsx'

// Landing page for an invitation link: confirms who it's for, takes a
// password, and signs the person straight in.
export default function InvitePage() {
  const { token } = useParams()
  const { setUser } = useSession()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | invalid
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/auth/invitations/${token}`).then((data) => { setInvitation(data.invitation); setName(data.invitation.name); setState('ready') })
      .catch((requestError) => { setError(requestError.message); setState('invalid') })
  }, [token])

  async function submit(event) {
    event.preventDefault(); setError(''); setFields({})
    if (password !== confirm) return setFields({ confirm: 'The two passwords do not match.' })
    setBusy(true)
    try {
      const data = await api.post(`/auth/invitations/${token}/accept`, { name: name.trim() || undefined, password })
      setUser(data.user); navigate('/', { replace: true })
    } catch (requestError) { setError(requestError.message); setFields(requestError.fields || {}) }
    finally { setBusy(false) }
  }

  if (state === 'loading') return <LoadingBlock text="Checking your invitation…" />
  if (state === 'invalid') return (
    <div>
      <p className="eyebrow">Invitation</p><h2>This link has expired.</h2>
      <Notice tone="error">{error}</Notice>
      <p className="aux">Ask Waldo for a fresh invitation, or <Link to="/login">sign in</Link> if you already have a password.</p>
    </div>
  )
  return (
    <form onSubmit={submit} noValidate>
      <p className="eyebrow">You're invited</p><h2>Set your password.</h2>
      <p>This account is for <strong>{invitation.email}</strong>. Choose a password and you're in.</p>
      <Field label="Your name" id="name"><input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field label="Password" id="password" hint="At least 10 characters." error={fields.password}><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required /></Field>
      <Field label="Confirm password" id="confirm" error={fields.confirm}><input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
      <Notice tone="error">{error}</Notice>
      <button className="button primary" disabled={busy || password.length < 10 || !confirm}>{busy ? 'Setting up…' : 'Create my account'} <span>→</span></button>
    </form>
  )
}
