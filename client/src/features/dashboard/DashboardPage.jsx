import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingScreen } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { firstName, formatDate } from '../../lib/format.js'
import { useSession } from '../auth/SessionContext.jsx'

export default function DashboardPage() {
  const { user } = useSession()
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState(null)
  const load = () => { setError(null); api.get('/projects').then((d) => setProjects(d.projects)).catch(setError) }
  useEffect(load, [])
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!projects) return <LoadingScreen />
  const admin = user.role === 'admin'
  return (
    <>
      <header className="page-head">
        <div><p className="eyebrow">Good to see you, {firstName(user.name)}</p><h1>{admin ? 'Every project.' : projects.length === 1 ? 'Your project.' : 'Your projects.'}</h1>
          <p>{admin ? 'Client work in flight, with what each one is waiting on.' : 'Milestones, decisions and updates — one calm place.'}</p></div>
        {admin && <Link className="button" to="/admin">Admin workspace <span>→</span></Link>}
      </header>
      {projects.length ? (
        <div className="card-grid">{projects.map((p) => {
          const next = p.pendingApprovals > 0 ? `${p.pendingApprovals} decision${p.pendingApprovals === 1 ? '' : 's'} waiting` : p.status === 'complete' ? 'Delivered' : 'In motion'
          return (
            <Link key={p.id} className="project-card" to={`/projects/${p.id}`}>
              <span className="client-name">{p.clientName}</span>
              <h2>{p.name}</h2>
              <div className="meter" aria-hidden="true"><i style={{ width: `${p.progress}%` }} /></div>
              <footer><span>{p.status} · {p.progress}%</span><span className={`next-tag${p.pendingApprovals > 0 ? '' : ' quiet'}`}>{next}</span></footer>
              <small className="meta">Milestones {p.milestonesDone}/{p.milestoneCount} · updated {formatDate(p.updatedAt)}</small>
            </Link>
          )
        })}</div>
      ) : <EmptyState title="No project assigned yet" text={admin ? 'Create a client and a project in the admin workspace.' : 'When your project is set up you will see it here.'}>{admin && <Link className="button" to="/admin">Open admin</Link>}</EmptyState>}
    </>
  )
}
