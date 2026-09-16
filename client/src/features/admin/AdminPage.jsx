import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { formatDate } from '../../lib/format.js'

export default function AdminPage() {
  const [clients, setClients] = useState(null)
  const [decisions, setDecisions] = useState(null)
  const [error, setError] = useState(null)
  const [name, setName] = useState(''); const [formError, setFormError] = useState(''); const [busy, setBusy] = useState(false)
  const load = () => { setError(null); Promise.all([api.get('/clients'), api.get('/admin/decisions')]).then(([c, d]) => { setClients(c.clients); setDecisions(d.decisions) }).catch(setError) }
  useEffect(load, [])
  async function create(event) {
    event.preventDefault(); setBusy(true); setFormError('')
    try { await api.post('/clients', { name }); setName(''); load() } catch (e) { setFormError(e.fields?.name || e.message) } finally { setBusy(false) }
  }
  if (error) return <ErrorState error={error} onRetry={load} />
  return (
    <>
      <header className="page-head"><div><p className="eyebrow">Studio workspace</p><h1>Admin.</h1><p>Clients, their people, and every decision still waiting.</p></div></header>
      <div className="admin-grid">
        <div className="stack">
          <Panel eyebrow="Clients" title="Businesses" aside={clients ? `${clients.length}` : ''}>
            {!clients ? <LoadingBlock /> : clients.length ? (
              <ul className="list">{clients.map((c) => <li key={c.id}><div><strong><Link to={`/admin/clients/${c.id}`} style={{ color: 'inherit' }}>{c.name}</Link></strong><small>{c.userCount} people · {c.projectCount} project{c.projectCount === 1 ? '' : 's'} · since {formatDate(c.createdAt)}</small></div><div className="actions"><Link className="button small" to={`/admin/clients/${c.id}`}>Open</Link></div></li>)}</ul>
            ) : <EmptyState title="No clients yet" text="Add the first business below." />}
            <form className="panel-form inline-form" onSubmit={create} noValidate>
              <Field label="New client" id="client-name" error={formError}><input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name" /></Field>
              <button className="button primary" disabled={busy || name.trim().length < 2}>{busy ? 'Adding…' : 'Add client'}</button>
            </form>
          </Panel>
        </div>
        <Panel eyebrow="Waiting on clients" title="Decisions" aside={decisions ? `${decisions.length} pending` : ''}>
          {!decisions ? <LoadingBlock /> : decisions.length ? (
            <ul className="list">{decisions.map((d) => <li key={d.id}><div><strong>{d.deliverableTitle} · v{d.versionNumber}</strong><small>{d.clientName} · {d.projectName} · asked {formatDate(d.createdAt)}{d.dueDate ? ` · due ${d.dueDate}` : ''}</small></div><div className="actions"><Link className="button small" to={`/projects/${d.projectId}/approvals`}>Open</Link></div></li>)}</ul>
          ) : <EmptyState title="Nothing outstanding" text="Every request has been answered." />}
        </Panel>
      </div>
      <Notice tone="info">Invitation links are shown once when you add a person; if email is not configured, copy the link and send it yourself.</Notice>
    </>
  )
}
