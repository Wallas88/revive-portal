import { notFound } from '../../lib/httpError.js'

// The one authorization rule for project-scoped data: admins see every
// project; a client user sees a project only with a project_memberships row.
// Unknown and forbidden both answer 404 so existence is never revealed.
export function projectAccess(db) {
  const lookup = db.prepare(`
    SELECT projects.id, projects.client_id AS clientId, projects.name, projects.summary, projects.status, projects.progress,
           projects.target_date AS targetDate, projects.created_at AS createdAt, projects.updated_at AS updatedAt,
           clients.name AS clientName
    FROM projects JOIN clients ON clients.id = projects.client_id
    WHERE projects.id = ?
      AND (? = 'admin' OR EXISTS (SELECT 1 FROM project_memberships pm WHERE pm.project_id = projects.id AND pm.user_id = ?))
  `)
  return {
    find: (user, projectId) => lookup.get(projectId, user.role, user.id) || null,
    // Express middleware: loads req.project or 404s. Mount after authenticate.
    require: (param = 'projectId') => (req, _res, next) => {
      const project = lookup.get(Number(req.params[param]), req.user.role, req.user.id)
      if (!project) return next(notFound('Project not found.'))
      req.project = project
      next()
    },
  }
}
