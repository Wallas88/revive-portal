import { useState } from 'react'
import Field from '../../components/ui/Field.jsx'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { useSession } from '../auth/SessionContext.jsx'
import { useProject } from '../projects/ProjectContext.jsx'

const STATES = ['upcoming', 'active', 'complete']

export default function MilestonesTab() {
  const { user } = useSession()
  const { milestones, projectId, reload } = useProject()
  const admin = user.role === 'admin'
  const [form, setForm] = useState({ title: '', dueDate: '', note: '' })
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const base = `/projects/${projectId}/milestones`

  async function add(event) {
    event.preventDefault(); setBusy(true); setError(''); setFields({})
    try { await api.post(base, { title: form.title, dueDate: form.dueDate || null, note: form.note }); setForm({ title: '', dueDate: '', note: '' }); await reload() }
    catch (requestError) { setError(requestError.message); setFields(requestError.fields || {}) }
    finally { setBusy(false) }
  }
  async function setState(id, state) { setError(''); try { await api.patch(`${base}/${id}`, { state }); await reload() } catch (requestError) { setError(requestError.message) } }
  async function remove(id, title) { if (!window.confirm(`Remove “${title}”?`)) return; try { await api.del(`${base}/${id}`); await reload() } catch (requestError) { setError(requestError.message) } }

  const done = milestones.filter((m) => m.state === 'complete').length
  return (
    <Panel className="milestones" eyebrow="The route ahead" title="Milestones" aside={`${done} of ${milestones.length}`}>
      {milestones.length ? (
        <ol>{milestones.map((step, index) => (
          <li className={step.state} key={step.id}>
            <span>{step.state === 'complete' ? '✓' : index + 1}</span>
            <div><strong>{step.title}</strong><small>{step.state}{step.dueDate ? ` · due ${step.dueDate}` : ''}</small>{step.note && <p style={{ margin: '.3rem 0 0', color: 'var(--muted)', fontSize: '.85rem' }}>{step.note}</p>}</div>
            {admin && <div className="milestone-controls"><label className="sr-only" htmlFor={`state-${step.id}`}>State for {step.title}</label><select id={`state-${step.id}`} value={step.state} onChange={(e) => setState(step.id, e.target.value)}>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select><button type="button" className="button danger small" onClick={() => remove(step.id, step.title)}>Remove</button></div>}
          </li>
        ))}</ol>
      ) : <EmptyState title="No milestones yet" text={admin ? 'Add the first stage below.' : 'The route will appear here once the plan is set.'} />}
      {error && <div className="panel-body"><Notice tone="error">{error}</Notice></div>}
      {admin && (
        <form className="panel-form" onSubmit={add} noValidate>
          <h3>Add a milestone</h3>
          <Field label="Title" id="ms-title" error={fields.title}><input id="ms-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="Due date" id="ms-due" error={fields.dueDate}><input id="ms-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Note for the client" id="ms-note"><input id="ms-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={600} /></Field>
          <div className="form-actions"><button className="button primary" disabled={busy || !form.title.trim()}>{busy ? 'Adding…' : 'Add milestone'}</button></div>
        </form>
      )}
    </Panel>
  )
}
