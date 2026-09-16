// Append-only record of who did what. meta must stay small and free of
// message bodies, file contents or tokens.
export function createAudit(db) {
  const insert = db.prepare('INSERT INTO audit_events (actor_id, project_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?, ?)')
  return {
    record({ actorId = null, projectId = null, action, entityType, entityId = null, meta = {} }) {
      insert.run(actorId, projectId, action, entityType, entityId, JSON.stringify(meta))
    },
    forProject(projectId, limit = 50) {
      return db.prepare(`
        SELECT audit_events.id, action, entity_type AS entityType, entity_id AS entityId, meta, audit_events.created_at AS createdAt, users.name AS actor
        FROM audit_events LEFT JOIN users ON users.id = audit_events.actor_id
        WHERE project_id = ? ORDER BY audit_events.created_at DESC, audit_events.id DESC LIMIT ?
      `).all(projectId, limit).map((row) => ({ ...row, meta: JSON.parse(row.meta) }))
    },
  }
}
