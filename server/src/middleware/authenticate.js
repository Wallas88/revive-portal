import { hashToken } from '../lib/tokens.js'
import { unauthorized } from '../lib/httpError.js'

export const SESSION_COOKIE = 'rp_session'

// Looks the session cookie up server-side. A revoked or expired row means no
// user; nothing about the user is trusted from the request itself.
export function sessionLookup(db) {
  const query = db.prepare(`
    SELECT sessions.id AS sessionId, users.id, users.name, users.email, users.role, users.status
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
      AND sessions.revoked_at IS NULL
      AND julianday(sessions.expires_at) > julianday('now')
      AND users.status = 'active'
  `)
  return (req, _res, next) => {
    const token = req.cookies?.[SESSION_COOKIE]
    if (token) {
      const row = query.get(hashToken(token))
      if (row) {
        req.user = { id: row.id, name: row.name, email: row.email, role: row.role }
        req.sessionId = row.sessionId
      }
    }
    next()
  }
}

export function authenticate(req, _res, next) {
  if (!req.user) return next(unauthorized())
  next()
}
