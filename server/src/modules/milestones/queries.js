export function milestoneQueries(db) {
  return {
    list: (projectId) => db.prepare('SELECT id, title, state, position, due_date AS dueDate, completed_at AS completedAt, note FROM milestones WHERE project_id = ? ORDER BY position, id').all(projectId),
    get: (projectId, id) => db.prepare('SELECT id, title, state, position, due_date AS dueDate, completed_at AS completedAt, note FROM milestones WHERE project_id = ? AND id = ?').get(projectId, id),
    nextPosition: (projectId) => (db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM milestones WHERE project_id = ?').get(projectId).next),
    insert: (projectId, { title, state, position, dueDate, note }) => db.prepare(
      'INSERT INTO milestones (project_id, title, state, position, due_date, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
    ).get(projectId, title, state, position, dueDate ?? null, note ?? ''),
    update: (projectId, id, fields) => {
      const map = { title: 'title', state: 'state', position: 'position', dueDate: 'due_date', note: 'note' }
      const sets = []; const values = []
      for (const [key, column] of Object.entries(map)) if (key in fields) { sets.push(`${column} = ?`); values.push(fields[key] ?? null) }
      if ('state' in fields) { sets.push('completed_at = ?'); values.push(fields.state === 'complete' ? new Date().toISOString() : null) }
      if (!sets.length) return
      db.prepare(`UPDATE milestones SET ${sets.join(', ')} WHERE project_id = ? AND id = ?`).run(...values, projectId, id)
    },
    remove: (projectId, id) => db.prepare('DELETE FROM milestones WHERE project_id = ? AND id = ?').run(projectId, id),
  }
}
