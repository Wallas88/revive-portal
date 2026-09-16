export function clientQueries(db) {
  return {
    list: () => db.prepare(`
      SELECT clients.id, clients.name, clients.created_at AS createdAt,
        (SELECT COUNT(*) FROM client_memberships cm WHERE cm.client_id = clients.id) AS userCount,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id = clients.id) AS projectCount
      FROM clients ORDER BY clients.name
    `).all(),
    get: (id) => db.prepare('SELECT id, name, created_at AS createdAt FROM clients WHERE id = ?').get(id),
    insert: (name) => db.prepare('INSERT INTO clients (name) VALUES (?) RETURNING id').get(name),
    rename: (id, name) => db.prepare('UPDATE clients SET name = ? WHERE id = ?').run(name, id),
    users: (clientId) => db.prepare(`
      SELECT users.id, users.name, users.email, users.status, users.created_at AS createdAt,
        (SELECT expires_at FROM invitations i WHERE i.user_id = users.id AND i.used_at IS NULL ORDER BY i.id DESC LIMIT 1) AS inviteExpiresAt
      FROM client_memberships cm JOIN users ON users.id = cm.user_id WHERE cm.client_id = ? ORDER BY users.name
    `).all(clientId),
    userByEmail: (email) => db.prepare('SELECT id, name, status FROM users WHERE email = ? COLLATE NOCASE').get(email),
    insertUser: ({ name, email }) => db.prepare("INSERT INTO users (name, email, role, status) VALUES (?, ?, 'client', 'invited') RETURNING id").get(name, email),
    addMembership: (clientId, userId) => db.prepare('INSERT OR IGNORE INTO client_memberships (client_id, user_id) VALUES (?, ?)').run(clientId, userId),
    isMember: (clientId, userId) => db.prepare('SELECT 1 FROM client_memberships WHERE client_id = ? AND user_id = ?').get(clientId, userId),
    userById: (id) => db.prepare('SELECT id, name, email, status FROM users WHERE id = ?').get(id),
    setStatus: (userId, status) => db.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'client'").run(status, userId),
    projects: (clientId) => db.prepare('SELECT id, name, status, progress, updated_at AS updatedAt FROM projects WHERE client_id = ? ORDER BY updated_at DESC').all(clientId),
  }
}
