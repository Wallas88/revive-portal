import { useState } from 'react'
import { Link } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import { Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const data = await api.post('/auth/password-resets', { email }); setDone(data.message) }
    catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate>
      <p className="eyebrow">Password</p><h2>Reset it.</h2><p>Enter your email and we'll send a link that works once.</p>
      <Field label="Email address" id="email"><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus /></Field>
      <Notice tone="error">{error}</Notice><Notice tone="success">{done}</Notice>
      {!done && <button className="button primary" disabled={busy || !email}>{busy ? 'Sending…' : 'Send reset link'} <span>→</span></button>}
      <p className="aux"><Link to="/login">Back to sign in</Link></p>
    </form>
  )
}
