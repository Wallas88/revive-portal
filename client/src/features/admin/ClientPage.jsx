import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import Field from '../../components/ui/Field.jsx'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState, ErrorState, LoadingScreen, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { formatDate } from '../../lib/format.js'

function InviteLink({ invitation }) {
  const [copied, setCopied] = useState(false)
  async function copy() { try { await navigator.clipboard.writeText(invitation.url); setCopied(true) } catch { setCopied(false) } }
  return (
    <div className="invite-link" role="status">
      <strong>{invitation.emailed ? 'Invitation emailed.' : 'Send this invitation link yourself'} <small className="meta">· works once, {invitation.expiresInDays} days</small></strong>
      <code>{invitation.url}</code>
      <div className="form-actions"><button type="button" className="button small" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button></div>
    </div>
  )
}

export default function ClientPage() {
  const { clientId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [invite, setInvite] = useState({ name: '', email: '' })
  const [lastInvite, setLastInvite] = useState(null)
  const [notice, setNotice] = useState({})
  const [project, setProject] = useState({ name: '', summary: '', targetDate: '' })
  const [members, setMembers] = useState({}) // projectId -> members[]
  const [busy, setBusy] = useState('')
  const load = useCallback(() => { setError(null); api.get(`/clients/${clientId}`).then(setData).catch(setError) }, [clientId])
  useEffect(load, [load])
  useEffect(() => {
    if (!data) return
    Promise.all(data.projects.map((p) => api.get(`/projects/${p.id}`).then((d) => [p.id, d.members]))).then((pairs) => setMembers(Object.fromEntries(pairs))).catch(() => {})
  }, [data])

  async function addUser(event) {
    event.preventDefault(); setBusy('invite'); setNotice({}); setLastInvite(null)
    try { const res = await api.post(`/clients/${clientId}/users`, invite); setLastInvite({ ...res.invitation, name: res.user.name }); setInvite({ name: '', email: '' }); load() }
    catch (e) { setNotice({ tone: 'error', text: e.fields?.email || e.fields?.name || e.message }) } finally { setBusy('') }
  }
  async function reinvite(user) { setNotice({}); try { const res = await api.post(`/clients/${clientId}/users/${user.id}/invitations`); setLastInvite({ ...res.invitation, name: user.name }); load() } catch (e) { setNotice({ tone: 'error', text: e.message }) } }
  async function setStatus(user, status) { setNotice({}); try { await api.patch(`/clients/${clientId}/users/${user.id}`, { status }); load() } catch (e) { setNotice({ tone: 'error', text: e.message }) } }
  async function createProject(event) {
    event.preventDefault(); setBusy('project'); setNotice({})
    try { await api.post('/projects', { clientId: Number(clientId), name: project.name, summary: project.summary, targetDate: project.targetDate || null }); setProject({ name: '', summary: '', targetDate: '' }); setNotice({ tone: 'success', text: 'Project created. Give someone access below.' }); load() }
    catch (e) { setNotice({ tone: 'error', text: e.fields?.name || e.message }) } finally { setBusy('') }
  }
  async function addMember(projectId, userId) { if (!userId) return; setNotice({}); try { const res = await api.post(`/projects/${projectId}/members`, { userId: Number(userId) }); setMembers({ ...members, [projectId]: res.members }) } catch (e) { setNotice({ tone: 'error', text: e.message }) } }
  async function removeMember(projectId, userId) { setNotice({}); try { const res = await api.del(`/projects/${projectId}/members/${userId}`); setMembers({ ...members, [projectId]: res.members }) } catch (e) { setNotice({ tone: 'error', text: e.message }) } }

  if (error) return <ErrorState error={error} onRetry={load} />
  if (!data) return <LoadingScreen text="Opening the client…" />
  const { client, users, projects } = data
  return (
    <>
      <header className="page-head"><div><p className="eyebrow"><Link to="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</Link> · Client</p><h1>{client.name}</h1><p>People who can sign in, and the projects they can see.</p></div></header>
      <Notice tone={notice.tone}>{notice.text}</Notice>
      <div className="admin-grid">
        <Panel eyebrow="People" title="Accounts" aside={`${users.length}`}>
          {users.length ? (
            <ul className="list">{users.map((u) => (
              <li key={u.id}>
                <div><strong>{u.name}</strong><small>{u.email} · {u.status}{u.status === 'invited' && u.inviteExpiresAt ? ` · link until ${formatDate(u.inviteExpiresAt)}` : ''}</small></div>
                <div className="actions">
                  {u.status !== 'disabled' && <button type="button" className="button small" onClick={() => reinvite(u)}>{u.status === 'invited' ? 'New link' : 'Re-invite'}</button>}
                  {u.status === 'active' && <button type="button" className="button small danger" onClick={() => setStatus(u, 'disabled')}>Disable</button>}
                  {u.status === 'disabled' && <button type="button" className="button small" onClick={() => setStatus(u, 'active')}>Enable</button>}
                </div>
              </li>
            ))}</ul>
          ) : <EmptyState title="Nobody invited yet" text="Add the first person below." />}
          <form className="panel-form" onSubmit={addUser} noValidate>
            <h3>Invite a person</h3>
            <div className="inline-form">
              <Field label="Name" id="inv-name"><input id="inv-name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></Field>
              <Field label="Email" id="inv-email"><input id="inv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
              <button className="button primary" disabled={busy === 'invite' || invite.name.trim().length < 2 || !invite.email}>{busy === 'invite' ? 'Inviting…' : 'Invite'}</button>
            </div>
            {lastInvite && <InviteLink invitation={lastInvite} />}
          </form>
        </Panel>
        <Panel eyebrow="Work" title="Projects" aside={`${projects.length}`}>
          {projects.length ? (
            <ul className="list">{projects.map((p) => (
              <li key={p.id}>
                <div>
                  <strong><Link to={`/projects/${p.id}`} style={{ color: 'inherit' }}>{p.name}</Link></strong><small>{p.status} · {p.progress}% · updated {formatDate(p.updatedAt)}</small>
                  <p>Access: {(members[p.id] || []).length ? (members[p.id] || []).map((m) => <span key={m.id} className="pill" style={{ marginRight: '.4rem' }}>{m.name} <button type="button" className="button small" style={{ minHeight: 0, padding: '0 .3rem', border: 0 }} aria-label={`Remove ${m.name} from ${p.name}`} onClick={() => removeMember(p.id, m.id)}>×</button></span>) : <span className="meta">nobody yet</span>}</p>
                  <div className="inline-form" style={{ marginTop: '.6rem' }}>
                    <div className="field"><label htmlFor={`add-${p.id}`}>Give access</label><select id={`add-${p.id}`} defaultValue="" onChange={(e) => { addMember(p.id, e.target.value); e.target.value = '' }}><option value="">Choose a person…</option>{users.filter((u) => u.status !== 'disabled' && !(members[p.id] || []).some((m) => m.id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                  </div>
                </div>
                <div className="actions"><Link className="button small" to={`/projects/${p.id}`}>Open</Link></div>
              </li>
            ))}</ul>
          ) : <EmptyState title="No projects yet" text="Create the first one below." />}
          <form className="panel-form" onSubmit={createProject} noValidate>
            <h3>New project</h3>
            <Field label="Name" id="pr-name"><input id="pr-name" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} /></Field>
            <Field label="Summary for the client" id="pr-summary"><input id="pr-summary" value={project.summary} onChange={(e) => setProject({ ...project, summary: e.target.value })} maxLength={600} /></Field>
            <Field label="Target handover" id="pr-date"><input id="pr-date" type="date" value={project.targetDate} onChange={(e) => setProject({ ...project, targetDate: e.target.value })} /></Field>
            <div className="form-actions"><button className="button primary" disabled={busy === 'project' || project.name.trim().length < 2}>{busy === 'project' ? 'Creating…' : 'Create project'}</button></div>
          </form>
        </Panel>
      </div>
    </>
  )
}
