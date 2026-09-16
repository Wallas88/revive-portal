import { useEffect, useState } from 'react'
import Field from '../../components/ui/Field.jsx'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { formatDateTime, statusLabel } from '../../lib/format.js'
import { useSession } from '../auth/SessionContext.jsx'
import { useProject } from '../projects/ProjectContext.jsx'

// The client's decision on one exact version.
function DecisionForm({ request, projectId, onDone }) {
  const [decision, setDecision] = useState('approved')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setFields({})
    try { await api.post(`/projects/${projectId}/approval-requests/${request.id}/responses`, { decision, feedback }); onDone(decision) }
    catch (requestError) { setError(requestError.message); setFields(requestError.fields || {}) }
    finally { setBusy(false) }
  }
  return (
    <form className="decision" onSubmit={submit} noValidate>
      <h3>Your decision</h3>
      {request.message && <p style={{ margin: '0 0 .6rem', color: 'var(--muted)' }}>{request.message}</p>}
      <div className="form-actions" role="radiogroup" aria-label="Decision">
        <button type="button" className={`button small${decision === 'approved' ? ' is-selected' : ' secondary'}`} aria-pressed={decision === 'approved'} onClick={() => setDecision('approved')}>Approve</button>
        <button type="button" className={`button small${decision === 'changes_requested' ? ' is-selected' : ' secondary'}`} aria-pressed={decision === 'changes_requested'} onClick={() => setDecision('changes_requested')}>Request changes</button>
      </div>
      <Field label={decision === 'approved' ? 'A note (optional)' : 'What should change?'} id={`fb-${request.id}`} error={fields.feedback}>
        <textarea id={`fb-${request.id}`} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} placeholder={decision === 'approved' ? 'Anything to add?' : 'Be specific — page, element, what you expected.'} />
      </Field>
      <Notice tone="error">{error}</Notice>
      <div className="form-actions"><button type="submit" className="button primary" disabled={busy || (decision === 'changes_requested' && !feedback.trim())}>{busy ? 'Saving…' : decision === 'approved' ? 'Confirm approval' : 'Send change request'} <span>→</span></button></div>
    </form>
  )
}

function Version({ version, deliverable, files, onChange }) {
  const { user } = useSession()
  const { projectId } = useProject()
  const admin = user.role === 'admin'
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')
  const open = version.requests.find((r) => r.status === 'pending')
  const latest = version.requests[0]
  async function request(event) {
    event.preventDefault(); setError('')
    try { await api.post(`/projects/${projectId}/versions/${version.id}/approval-requests`, { message }); setRequesting(false); setMessage(''); onChange() } catch (e) { setError(e.message) }
  }
  async function withdraw(id) { setError(''); try { await api.post(`/projects/${projectId}/approval-requests/${id}/withdraw`); onChange() } catch (e) { setError(e.message) } }
  return (
    <div className="version">
      <div className="version-head">
        <div><strong>Version {version.versionNumber}</strong> <small className="meta"> · {version.createdBy} · {formatDateTime(version.createdAt)}</small></div>
        {latest ? <span className={`pill ${latest.status}`}>{statusLabel(latest.status)}</span> : <span className="pill">no decision asked</span>}
      </div>
      {version.note && <p style={{ margin: '.5rem 0 0', color: '#bdcbc0' }}>{version.note}</p>}
      <div className="version-links">
        {version.previewUrl && <a className="button small" href={version.previewUrl} target="_blank" rel="noreferrer">Open preview <span>↗</span></a>}
        {version.fileId && <a className="button small" href={`/api/projects/${projectId}/files/${version.fileId}/download`}>Download {version.fileName} <span>↓</span></a>}
        {admin && !open && !requesting && <button type="button" className="button small primary" onClick={() => setRequesting(true)}>Ask for a decision</button>}
        {admin && open && <button type="button" className="button small danger" onClick={() => withdraw(open.id)}>Withdraw request</button>}
      </div>
      {admin && requesting && (
        <form className="decision" onSubmit={request}>
          <h3>Ask {deliverable.title} v{version.versionNumber} to be reviewed</h3>
          <Field label="Message to the client" id={`req-${version.id}`}><textarea id={`req-${version.id}`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="What to look at, and by when." /></Field>
          <div className="form-actions"><button type="submit" className="button primary">Send request</button><button type="button" className="button secondary" onClick={() => setRequesting(false)}>Cancel</button></div>
        </form>
      )}
      {!admin && open && <DecisionForm request={open} projectId={projectId} onDone={(d) => { setNotice(d === 'approved' ? 'Approved — thank you. Waldo has been notified.' : 'Change request sent. Waldo will pick it up from here.'); onChange() }} />}
      <Notice tone="success">{notice}</Notice><Notice tone="error">{error}</Notice>
      {version.requests.some((r) => r.responses.length) && (
        <ul className="history">{version.requests.flatMap((r) => r.responses.map((resp) => (
          <li key={resp.id}><span><strong>{resp.respondedBy}</strong> {resp.decision === 'approved' ? 'approved this version' : 'requested changes'}{resp.feedback ? ` — “${resp.feedback}”` : ''}</span><time>{formatDateTime(resp.createdAt)}</time></li>
        )))}</ul>
      )}
    </div>
  )
}

function AddVersion({ deliverable, files, onDone }) {
  const { projectId } = useProject()
  const [form, setForm] = useState({ note: '', previewUrl: '', fileId: '' })
  const [error, setError] = useState(''); const [fields, setFields] = useState({}); const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setFields({})
    try { await api.post(`/projects/${projectId}/deliverables/${deliverable.id}/versions`, { note: form.note, previewUrl: form.previewUrl || null, fileId: form.fileId ? Number(form.fileId) : null }); setForm({ note: '', previewUrl: '', fileId: '' }); onDone() }
    catch (e) { setError(e.message); setFields(e.fields || {}) } finally { setBusy(false) }
  }
  return (
    <form className="panel-form" onSubmit={submit} noValidate>
      <h3>Add version {deliverable.versions.length + 1} of {deliverable.title}</h3>
      <Field label="Preview link" id={`pv-${deliverable.id}`} error={fields.previewUrl} hint="A link the client can open, or attach a shared file below."><input id={`pv-${deliverable.id}`} type="url" value={form.previewUrl} onChange={(e) => setForm({ ...form, previewUrl: e.target.value })} placeholder="https://…" /></Field>
      <Field label="Attach a shared file" id={`file-${deliverable.id}`} error={fields.fileId}><select id={`file-${deliverable.id}`} value={form.fileId} onChange={(e) => setForm({ ...form, fileId: e.target.value })}><option value="">None</option>{files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
      <Field label="What changed" id={`note-${deliverable.id}`}><input id={`note-${deliverable.id}`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={1000} /></Field>
      <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? 'Adding…' : 'Add version'}</button></div>
      <Notice tone="error">{error}</Notice>
    </form>
  )
}

export default function ApprovalsTab() {
  const { user } = useSession()
  const { deliverables, pendingApprovals, projectId, reload } = useProject()
  const admin = user.role === 'admin'
  const [files, setFiles] = useState([])
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState(''); const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (admin) api.get(`/projects/${projectId}/files`).then((d) => setFiles(d.files)).catch(() => {}) }, [admin, projectId])
  async function create(event) {
    event.preventDefault(); setError('')
    try { await api.post(`/projects/${projectId}/deliverables`, { title: newTitle, description: newDesc }); setNewTitle(''); setNewDesc(''); setCreating(false); reload() } catch (e) { setError(e.fields?.title || e.message) }
  }
  return (
    <>
      {!admin && pendingApprovals.length > 0 && <Notice tone="info">{pendingApprovals.length === 1 ? 'One decision is waiting for you below.' : `${pendingApprovals.length} decisions are waiting for you below.`}</Notice>}
      {deliverables.length ? deliverables.map((d) => (
        <Panel key={d.id} eyebrow="For review" title={d.title} aside={`${d.versions.length} version${d.versions.length === 1 ? '' : 's'}`}>
          <div className="panel-body">
            {d.description && <p>{d.description}</p>}
            {d.versions.length ? d.versions.map((v) => <Version key={v.id} version={v} deliverable={d} files={files} onChange={reload} />) : <EmptyState title="No version yet" text={admin ? 'Add the first version below.' : 'The first version is on its way.'} />}
          </div>
          {admin && <AddVersion deliverable={d} files={files} onDone={reload} />}
        </Panel>
      )) : <Panel eyebrow="For review" title="Approvals"><EmptyState title="Nothing to review yet" text={admin ? 'Add a deliverable to start collecting decisions.' : 'Designs and revisions will appear here when they are ready for your eyes.'} /></Panel>}
      {admin && (
        <Panel eyebrow="Studio" title="New deliverable">
          {creating ? (
            <form className="panel-form" onSubmit={create} noValidate>
              <Field label="Title" id="nd-title"><input id="nd-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Homepage design" required /></Field>
              <Field label="Description" id="nd-desc"><input id="nd-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={1000} /></Field>
              <Notice tone="error">{error}</Notice>
              <div className="form-actions"><button className="button primary" disabled={!newTitle.trim()}>Create</button><button type="button" className="button secondary" onClick={() => setCreating(false)}>Cancel</button></div>
            </form>
          ) : <div className="panel-body" style={{ paddingTop: '1.5rem' }}><button type="button" className="button" onClick={() => setCreating(true)}>Add a deliverable <span>+</span></button></div>}
        </Panel>
      )}
    </>
  )
}
