import { useEffect, useState } from 'react'
import { api, session } from './api.js'

const formatDate = (date) => new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))

function Mark() {
  return <svg viewBox="0 0 42 42" aria-hidden="true"><path d="M21 4c2.4 7.8 5.7 11.1 13.5 13.5C26.7 20 23.4 23.2 21 31c-2.4-7.8-5.7-11-13.5-13.5C15.3 15.1 18.6 11.8 21 4Z" /><path d="M33 29c.8 2.6 1.9 3.7 4.5 4.5-2.6.8-3.7 1.9-4.5 4.5-.8-2.6-1.9-3.7-4.5-4.5 2.6-.8 3.7-1.9 4.5-4.5Z" /></svg>
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('client@demo.local')
  const [password, setPassword] = useState('revive-demo')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      session.set(result.token)
      onLogin(result.user)
    } catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <a className="brand" href="/" aria-label="Revive Portal home"><span><Mark /></span><strong>Revive Portal</strong></a>
        <div><p className="eyebrow">Project clarity, without the theatre</p><h1>Your project.<br /><em>One calm place.</em></h1><p>Milestones, decisions, messages, and momentum—visible when you need them.</p></div>
        <small>Built by Waldo Trytsman · Pretoria → Worldwide</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">The client gate</p><h2>Welcome back.</h2><p>Use the demo account to explore the working portal.</p>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength="8" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>{busy ? 'Opening…' : 'Enter the portal'} <span>→</span></button>
          <p className="demo-note"><strong>Demo access</strong><span>client@demo.local · revive-demo</span></p>
        </form>
      </section>
    </main>
  )
}

function ProgressRing({ value }) {
  return <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` }}><div><strong>{value}%</strong><span>complete</span></div></div>
}

function Dashboard({ user, onLogout }) {
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function loadProject() {
    try {
      const list = await api('/projects')
      if (!list.projects[0]) return setError('No project has been assigned yet.')
      const detail = await api(`/projects/${list.projects[0].id}`)
      setProject(detail)
    } catch (requestError) { setError(requestError.message) }
  }

  useEffect(() => { loadProject() }, [])

  async function sendMessage(event) {
    event.preventDefault()
    if (!message.trim()) return
    setSending(true); setError('')
    try {
      await api(`/projects/${project.project.id}/messages`, { method: 'POST', body: JSON.stringify({ body: message }) })
      setMessage(''); await loadProject()
    } catch (requestError) { setError(requestError.message) }
    finally { setSending(false) }
  }

  if (!project) return <main className="loading"><Mark /><p>{error || 'Gathering the project…'}</p></main>
  const { project: item, milestones, messages } = project
  return (
    <div className="portal">
      <header className="topbar">
        <a className="brand" href="#top"><span><Mark /></span><strong>Revive Portal</strong></a>
        <div><span className="avatar">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><p><strong>{user.name}</strong><small>Client workspace</small></p><button onClick={onLogout}>Sign out</button></div>
      </header>
      <main id="top" className="dashboard">
        <header className="welcome"><div><p className="eyebrow">Good to see you, {user.name.split(' ')[0]}</p><h1>{item.name}</h1><p>{item.summary}</p></div><ProgressRing value={item.progress} /></header>
        <section className="pulse-strip"><div><small>Current phase</small><strong>{item.status}</strong></div><div><small>Target handover</small><strong>{formatDate(item.targetDate)}</strong></div><div><small>Last movement</small><strong>{formatDate(item.updatedAt)}</strong></div><span className="live"><i /> On track</span></section>

        <div className="dashboard-grid">
          <section className="panel milestones"><header><div><p className="eyebrow">The route ahead</p><h2>Milestones</h2></div><span>{milestones.filter((step) => step.state === 'complete').length} of {milestones.length}</span></header>
            <ol>{milestones.map((step, index) => <li className={step.state} key={step.id}><span>{step.state === 'complete' ? '✓' : index + 1}</span><div><strong>{step.title}</strong><small>{step.state}</small></div></li>)}</ol>
          </section>
          <aside className="panel next-action"><p className="eyebrow">Your next move</p><span className="action-icon">✦</span><h2>Review the responsive build</h2><p>Check the mobile service pages and leave one consolidated round of notes.</p><button className="button primary" onClick={() => document.getElementById('message')?.focus()}>Leave feedback <span>↓</span></button></aside>
        </div>

        <section className="panel conversation"><header><div><p className="eyebrow">The project channel</p><h2>Messages</h2></div><span>{messages.length} update{messages.length === 1 ? '' : 's'}</span></header>
          <div className="messages">{messages.map((entry) => <article key={entry.id}><span className="avatar">{entry.author.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><header><strong>{entry.author}</strong><time>{formatDate(entry.createdAt)}</time></header><p>{entry.body}</p></div></article>)}</div>
          <form onSubmit={sendMessage}><label htmlFor="message">Add a project note</label><textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength="2000" placeholder="One clear message beats five scattered emails…" /><footer><small>{message.length} / 2000</small><button className="button primary" disabled={sending || !message.trim()}>{sending ? 'Sending…' : 'Send update'} <span>↑</span></button></footer></form>
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
      </main>
      <footer className="site-footer"><span><Mark /></span><p><strong>Quiet systems. Clear progress.</strong><small>Revive Portal · built by Waldo Trytsman</small></p><a href="mailto:revivewebsitedev@gmail.com">Contact Waldo Trytsman ↗</a></footer>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(session.get()))
  useEffect(() => {
    if (!session.get()) return
    api('/me').then(({ user: current }) => setUser(current)).catch(() => session.clear()).finally(() => setChecking(false))
  }, [])
  async function logout() {
    try { await api('/auth/session', { method: 'DELETE' }) } finally { session.clear(); setUser(null) }
  }
  if (checking) return <main className="loading"><Mark /><p>Restoring your workspace…</p></main>
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />
}
