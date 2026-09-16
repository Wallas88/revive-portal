import { Link, Outlet, useParams } from 'react-router'
import ProgressRing from '../../components/ui/ProgressRing.jsx'
import Tabs from '../../components/ui/Tabs.jsx'
import { ErrorState, LoadingScreen } from '../../components/ui/States.jsx'
import { formatDate } from '../../lib/format.js'
import { useSession } from '../auth/SessionContext.jsx'
import { ProjectProvider, useProject } from './ProjectContext.jsx'

function Header() {
  const { user } = useSession()
  const { project, loaded, error, reload, pendingApprovals, projectId } = useProject()
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!loaded) return <LoadingScreen />
  const base = `/projects/${projectId}`
  const tabs = [
    { to: base, label: 'Overview', end: true },
    { to: `${base}/milestones`, label: 'Milestones' },
    { to: `${base}/approvals`, label: 'Approvals', count: user.role === 'admin' ? 0 : pendingApprovals.length },
    { to: `${base}/messages`, label: 'Messages' },
    { to: `${base}/files`, label: 'Files' },
  ]
  return (
    <>
      <header className="welcome project-head">
        <div>
          <p className="eyebrow"><Link to="/">Dashboard</Link> · {project.clientName}</p>
          <h1>{project.name}</h1>
          <p>{project.summary}</p>
        </div>
        <ProgressRing value={project.progress} />
      </header>
      <section className="pulse-strip">
        <div><small>Current phase</small><strong>{project.status}</strong></div>
        <div><small>Target handover</small><strong>{formatDate(project.targetDate)}</strong></div>
        <div><small>Last movement</small><strong>{formatDate(project.updatedAt)}</strong></div>
        <span className="live"><i /> {project.status === 'complete' ? 'Delivered' : 'In motion'}</span>
      </section>
      <Tabs items={tabs} ariaLabel="Project sections" />
      <div className="tab-body"><Outlet /></div>
    </>
  )
}

export default function ProjectPage() {
  const { projectId } = useParams()
  return <ProjectProvider projectId={projectId}><Header /></ProjectProvider>
}
