// SQL for accounts, sessions, invitations and resets. No business rules here.
export function authQueries(db) {
  return {
    userByEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email),
    userById: (id) => db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(id),
    setPassword: (userId, hash) => db.prepare("UPDATE users SET password_hash = ?, status = 'active' WHERE id = ?").run(hash, userId),
    setName: (userId, name) => db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId),

    insertSession: (tokenHash, userId, expiresAt) => db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?) RETURNING id').get(tokenHash, userId, expiresAt),
    revokeSession: (sessionId) => db.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL').run(sessionId),
    revokeAllSessions: (userId) => db.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').run(userId),
    purgeExpiredSessions: () => db.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now', '-7 days')").run(),

    insertInvitation: (userId, tokenHash, createdBy, expiresAt) => db.prepare('INSERT INTO invitations (user_id, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?) RETURNING id').get(userId, tokenHash, createdBy, expiresAt),
    invitationByHash: (tokenHash) => db.prepare(`
      SELECT invitations.id, invitations.user_id AS userId, invitations.expires_at AS expiresAt, invitations.used_at AS usedAt,
             users.name, users.email, users.status
      FROM invitations JOIN users ON users.id = invitations.user_id WHERE token_hash = ?
    `).get(tokenHash),
    useInvitation: (id) => db.prepare('UPDATE invitations SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL').run(id),
    voidOpenInvitations: (userId) => db.prepare('UPDATE invitations SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(userId),

    insertReset: (userId, tokenHash, expiresAt) => db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(userId, tokenHash, expiresAt),
    resetByHash: (tokenHash) => db.prepare('SELECT id, user_id AS userId, expires_at AS expiresAt, used_at AS usedAt FROM password_resets WHERE token_hash = ?').get(tokenHash),
    useReset: (id) => db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL').run(id),
  }
}
