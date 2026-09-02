import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import { createSessionToken, hashToken, verifyPassword } from './auth.js'

const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) })
const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) })

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export function createApp(db, options = {}) {
  const app = express()
  const sessionHours = Number(options.sessionHours || process.env.SESSION_HOURS || 12)
  const attempts = new Map()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }))
  app.use(express.json({ limit: '32kb' }))

  app.use((req, res, next) => {
    res.setHeader('Cache-Control', req.path.startsWith('/api') ? 'no-store' : 'public, max-age=300')
    next()
  })

  function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Authentication required.' })
    const session = db.prepare(`
      SELECT users.id, users.name, users.email, users.role
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND julianday(sessions.expires_at) > julianday('now')
    `).get(hashToken(token))
    if (!session) return res.status(401).json({ error: 'Session expired or invalid.' })
    req.user = session
    req.tokenHash = hashToken(token)
    next()
  }

  function canAccessProject(user, projectId) {
    return db.prepare('SELECT id FROM projects WHERE id = ? AND (client_id = ? OR ? = \'admin\')').get(projectId, user.id, user.role)
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

  app.post('/api/auth/login', (req, res) => {
    const key = req.ip || 'local'
    const record = attempts.get(key) || { count: 0, reset: Date.now() + 60_000 }
    if (Date.now() > record.reset) Object.assign(record, { count: 0, reset: Date.now() + 60_000 })
    record.count += 1
    attempts.set(key, record)
    if (record.count > 10) return res.status(429).json({ error: 'Too many attempts. Try again shortly.' })

    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' })
    const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(parsed.data.email)
    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' })
    }
    const token = createSessionToken()
    const expires = new Date(Date.now() + sessionHours * 3_600_000).toISOString()
    db.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')").run()
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), user.id, expires)
    res.json({ token, user: publicUser(user) })
  })

  app.delete('/api/auth/session', authenticate, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash)
    res.status(204).end()
  })

  app.get('/api/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }))

  app.get('/api/projects', authenticate, (req, res) => {
    const projects = db.prepare(`
      SELECT id, name, summary, status, progress, target_date AS targetDate, updated_at AS updatedAt
      FROM projects WHERE client_id = ? OR ? = 'admin' ORDER BY updated_at DESC
    `).all(req.user.id, req.user.role)
    res.json({ projects })
  })

  app.get('/api/projects/:id', authenticate, (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || !canAccessProject(req.user, id)) return res.status(404).json({ error: 'Project not found.' })
    const project = db.prepare('SELECT id, name, summary, status, progress, target_date AS targetDate, updated_at AS updatedAt FROM projects WHERE id = ?').get(id)
    const milestones = db.prepare('SELECT id, title, state, position FROM milestones WHERE project_id = ? ORDER BY position').all(id)
    const messages = db.prepare(`SELECT messages.id, messages.body, messages.created_at AS createdAt, users.name AS author FROM messages JOIN users ON users.id = messages.author_id WHERE project_id = ? ORDER BY messages.created_at DESC LIMIT 20`).all(id)
    res.json({ project, milestones, messages })
  })

  app.post('/api/projects/:id/messages', authenticate, (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || !canAccessProject(req.user, id)) return res.status(404).json({ error: 'Project not found.' })
    const parsed = messageSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Message must contain between 1 and 2,000 characters.' })
    const message = db.prepare('INSERT INTO messages (project_id, author_id, body) VALUES (?, ?, ?) RETURNING id, body, created_at AS createdAt')
      .get(id, req.user.id, parsed.data.body)
    res.status(201).json({ message: { ...message, author: req.user.name } })
  })

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }))
  app.use((error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ error: 'Something went wrong.' })
  })
  return app
}
