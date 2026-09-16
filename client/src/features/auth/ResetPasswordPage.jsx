import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import { Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setFields({})
    if (password !== confirm) return setFields({ confirm: 'The two passwords do not match.' })
    setBusy(true)
    try { await api.post(`/auth/password-resets/${token}`, { password }); navigate('/login', { replace: true, state: { notice: 'Password changed. Sign in with the new one.' } }) }
    catch (requestError) { setError(requestError.message); setFields(requestError.fields || {}) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate>
      <p className="eyebrow">Password</p><h2>Choose a new one.</h2>
      <Field label="New password" id="password" hint="At least 10 characters." error={fields.password}><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required autoFocus /></Field>
      <Field label="Confirm password" id="confirm" error={fields.confirm}><input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
      <Notice tone="error">{error}</Notice>
      <button className="button primary" disabled={busy || password.length < 10 || !confirm}>{busy ? 'Saving…' : 'Save password'} <span>→</span></button>
      <p className="aux"><Link to="/login">Back to sign in</Link></p>
    </form>
  )
}
