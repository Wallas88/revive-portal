import { Link } from 'react-router'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState } from '../../components/ui/States.jsx'
import { formatDateTime } from '../../lib/format.js'
import { useSession } from '../auth/SessionContext.jsx'
import { useProject } from './ProjectContext.jsx'
import { nextAction } from './nextAction.js'

const describe = (event) => {
  const m = event.meta || {}
  const map = {
    'approval.requested': `asked for a decision on ${m.title} v${m.version}`,
    'approval.approved': `approved ${m.title} v${m.version}`,
    'approval.changes_requested': `requested changes on ${m.title} v${m.version}`,
    'approval.withdrawn': `withdrew the request on ${m.title} v${m.version}`,
    'deliverable.created': `added a deliverable: ${m.title}`,
    'deliverable.version_added': `uploaded ${m.title} v${m.version}`,
    'milestone.created': `added milestone “${m.title}”`,
    'milestone.updated': m.to ? `moved “${m.title}” to ${m.to}` : `updated milestone “${m.title}”`,
    'milestone.deleted': `removed milestone “${m.title}”`,
    'message.posted': 'posted in the channel',
    'file.uploaded': `shared ${m.name}`,
    'file.deleted': `removed ${m.name}`,
    'project.updated': 'updated the project details',
    'project.created': 'created the project',
    'project.member_added': 'gave someone access',
    'project.member_removed': 'removed someone\'s access',
  }
  return map[event.action] || event.action.replace(/[._]/g, ' ')
}

export default function OverviewTab() {
  const { user } = useSession()
  const { milestones, pendingApprovals, activity, project, projectId } = useProject()
  const action = nextAction({ pendingApprovals, milestones, lastMessageAt: project.lastMessageAt, userRole: user.role })
  const done = milestones.filter((m) => m.state === 'complete').length
  return (
    <>
      <div className="dashboard-grid">
        <Panel className="milestones" eyebrow="The route ahead" title="Milestones" aside={`${done} of ${milestones.length}`}>
          {milestones.length ? (
            <ol>{milestones.map((step, index) => <li className={step.state} key={step.id}><span>{step.state === 'complete' ? '✓' : index + 1}</span><div><strong>{step.title}</strong><small>{step.state}{step.dueDate ? ` · ${step.dueDate}` : ''}</small></div></li>)}</ol>
          ) : <EmptyState title="No milestones yet" text="The route will appear here once the plan is set." />}
        </Panel>
        <aside className="panel next-action">
          <p className="eyebrow">{user.role === 'admin' ? 'Client\'s next move' : 'Your next move'}</p>
          <span className="action-icon" aria-hidden="true">✦</span>
          <h2>{action.title}</h2><p>{action.text}</p>
          <Link className="button primary" to={`/projects/${projectId}/${action.to}`}>{action.label} <span>→</span></Link>
        </aside>
      </div>
      <Panel eyebrow="What happened" title="Activity" aside={`${activity.length} recent`}>
        {activity.length ? (
          <ul className="list activity">{activity.map((event) => <li key={event.id}><div><strong><span className="who">{event.actor || 'Someone'}</span> {describe(event)}</strong></div><small>{formatDateTime(event.createdAt)}</small></li>)}</ul>
        ) : <EmptyState title="Quiet so far" text="Changes, decisions and uploads will be listed here." />}
      </Panel>
    </>
  )
}
