import { timingSafeEqual } from 'node:crypto'
import { createToken, hashPassword, hashToken, verifyPassword } from '../../lib/tokens.js'
import { HttpError, badRequest, unauthorized } from '../../lib/httpError.js'
import { authQueries } from './queries.js'

const INVITE_DAYS = 7
const RESET_HOURS = 2
const hoursFromNow = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString()
const isLive = (row) => row && !row.usedAt && new Date(row.expiresAt).getTime() > Date.now()

export const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role })

// Business rules for signing in, invitations and resets. Routes call these;
// nothing here knows about HTTP beyond the errors it throws.
export function authService({ db, env, audit, email }) {
  const q = authQueries(db)

  function startSession(user) {
    const token = createToken()
    q.purgeExpiredSessions()
    const expiresAt = hoursFromNow(env.SESSION_HOURS)
    const session = q.insertSession(hashToken(token), user.id, expiresAt)
    return { token, sessionId: session.id, expiresAt, maxAge: env.SESSION_HOURS * 3600 }
  }

  return {
    login(emailAddress, password) {
      const user = q.userByEmail(emailAddress)
      // Same answer for unknown email, wrong password and not-yet-accepted invite.
      if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
        throw unauthorized('Email or password is incorrect.')
      }
      const session = startSession(user)
      audit.record({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id })
      return { user: publicUser(user), session }
    },

    logout(sessionId, userId) {
      q.revokeSession(sessionId)
      audit.record({ actorId: userId, action: 'auth.logout', entityType: 'session', entityId: sessionId })
    },

    // Called by the clients module when an admin adds a user. Returns the raw
    // token once; only its hash is kept.
    createInvitation(userId, createdBy) {
      const token = createToken()
      q.voidOpenInvitations(userId)
      q.insertInvitation(userId, hashToken(token), createdBy, hoursFromNow(INVITE_DAYS * 24))
      const url = `${env.APP_URL}/invite/${token}`
      audit.record({ actorId: createdBy, action: 'invitation.created', entityType: 'user', entityId: userId, meta: { expiresInDays: INVITE_DAYS } })
      return { token, url, expiresInDays: INVITE_DAYS }
    },

    async deliverInvitation(user, invitation) {
      const result = await email.send({
        to: user.email,
        subject: 'Your Revive Portal invitation',
        text: `Hi ${user.name},\n\nYou have been invited to the Revive Portal to follow your website project.\n\nSet your password here (the link works once and expires in ${invitation.expiresInDays} days):\n${invitation.url}\n\nIf you were not expecting this, ignore this email.`,
      })
      return result.sent
    },

    inspectInvitation(token) {
      const row = q.invitationByHash(hashToken(token))
      if (!isLive(row) || row.status === 'disabled') throw new HttpError(410, 'This invitation link has expired or was already used. Ask for a new one.')
      return { name: row.name, email: row.email }
    },

    acceptInvitation(token, { name, password }) {
      const row = q.invitationByHash(hashToken(token))
      if (!isLive(row) || row.status === 'disabled') throw new HttpError(410, 'This invitation link has expired or was already used. Ask for a new one.')
      db.exec('BEGIN')
      try {
        q.useInvitation(row.id)
        if (name) q.setName(row.userId, name)
        q.setPassword(row.userId, hashPassword(password))
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      const user = q.userById(row.userId)
      const session = startSession(user)
      audit.record({ actorId: user.id, action: 'invitation.accepted', entityType: 'user', entityId: user.id })
      return { user: publicUser(user), session }
    },

    async requestPasswordReset(emailAddress) {
      const user = q.userByEmail(emailAddress)
      // Always the same answer to the caller — no account enumeration.
      if (!user || user.status !== 'active') return { sent: false }
      const token = createToken()
      q.insertReset(user.id, hashToken(token), hoursFromNow(RESET_HOURS))
      const url = `${env.APP_URL}/reset/${token}`
      audit.record({ actorId: user.id, action: 'password_reset.requested', entityType: 'user', entityId: user.id })
      const result = await email.send({
        to: user.email, subject: 'Reset your Revive Portal password',
        text: `Hi ${user.name},\n\nSomeone asked to reset the password for this account. If that was you, use this link within ${RESET_HOURS} hours (it works once):\n${url}\n\nIf it was not you, ignore this email — nothing changes.`,
      })
      return { sent: result.sent }
    },

    completePasswordReset(token, password) {
      const row = q.resetByHash(hashToken(token))
      if (!isLive(row)) throw new HttpError(410, 'This reset link has expired or was already used. Request a new one.')
      db.exec('BEGIN')
      try {
        q.useReset(row.id)
        q.setPassword(row.userId, hashPassword(password))
        q.revokeAllSessions(row.userId)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      audit.record({ actorId: row.userId, action: 'password_reset.completed', entityType: 'user', entityId: row.userId })
      return true
    },

    validatePassword(password) {
      if (password.length < 10) throw badRequest('Check the highlighted fields.', { password: 'Use at least 10 characters.' })
    },

    // First-run setup: open only while there is no admin and a SETUP_TOKEN is
    // configured. Same 404 for "closed" and "no token" so nothing is revealed.
    setupAvailable() {
      return Boolean(env.SETUP_TOKEN) && !q.adminExists()
    },
    setupAdmin({ token, name, email: emailAddress, password }) {
      if (!this.setupAvailable()) throw new HttpError(404, 'Setup is closed.')
      const expected = Buffer.from(env.SETUP_TOKEN)
      const given = Buffer.from(String(token || ''))
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(403, 'That setup token is not right.')
      if (q.userByEmail(emailAddress)) throw badRequest('Check the highlighted fields.', { email: 'That email already has an account.' })
      const { id } = q.insertAdmin({ name, email: emailAddress.toLowerCase(), passwordHash: hashPassword(password) })
      const user = q.userById(id)
      const session = startSession(user)
      audit.record({ actorId: user.id, action: 'auth.setup', entityType: 'user', entityId: user.id })
      return { user: publicUser(user), session }
    },
  }
}
