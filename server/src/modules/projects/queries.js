const PROJECT_COLUMNS = `projects.id, projects.client_id AS clientId, projects.name, projects.summary, projects.status, projects.progress,
  projects.target_date AS targetDate, projects.created_at AS createdAt, projects.updated_at AS updatedAt, clients.name AS clientName`

export function projectQueries(db) {
  return {
    // Scoped list: everything for admins, memberships only for clients.
    listFor: (user) => db.prepare(`
      SELECT ${PROJECT_COLUMNS},
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = projects.id) AS milestoneCount,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = projects.id AND m.state = 'complete') AS milestonesDone,
        (SELECT COUNT(*) FROM approval_requests ar JOIN deliverable_versions dv ON dv.id = ar.deliverable_version_id
           JOIN deliverables d ON d.id = dv.deliverable_id WHERE d.project_id = projects.id AND ar.status = 'pending') AS pendingApprovals,
        (SELECT MAX(created_at) FROM messages msg WHERE msg.project_id = projects.id) AS lastMessageAt
      FROM projects JOIN clients ON clients.id = projects.client_id
      WHERE ? = 'admin' OR EXISTS (SELECT 1 FROM project_memberships pm WHERE pm.project_id = projects.id AND pm.user_id = ?)
      ORDER BY projects.updated_at DESC
    `).all(user.role, user.id),

    insert: ({ clientId, name, summary, status, progress, targetDate }) => db.prepare(`
      INSERT INTO projects (client_id, name, summary, status, progress, target_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING id
    `).get(clientId, name, summary, status, progress, targetDate ?? null),

    update: (id, fields) => {
      const allowed = ['name', 'summary', 'status', 'progress', 'targetDate']
      const sets = []; const values = []
      for (const key of allowed) if (key in fields) { sets.push(`${key === 'targetDate' ? 'target_date' : key} = ?`); values.push(fields[key] ?? null) }
      if (!sets.length) return
      db.prepare(`UPDATE projects SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id)
    },
    touch: (id) => db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id),

    members: (projectId) => db.prepare(`
      SELECT users.id, users.name, users.email, users.status FROM project_memberships pm JOIN users ON users.id = pm.user_id
      WHERE pm.project_id = ? ORDER BY users.name
    `).all(projectId),
    addMember: (projectId, userId) => db.prepare('INSERT OR IGNORE INTO project_memberships (project_id, user_id) VALUES (?, ?)').run(projectId, userId),
    removeMember: (projectId, userId) => db.prepare('DELETE FROM project_memberships WHERE project_id = ? AND user_id = ?').run(projectId, userId),
    // A user may only be given a project belonging to a client they belong to.
    userBelongsToClient: (userId, clientId) => db.prepare('SELECT 1 FROM client_memberships WHERE user_id = ? AND client_id = ?').get(userId, clientId),
  }
}
