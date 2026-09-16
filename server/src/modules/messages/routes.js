import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { id, validateRequest } from '../../middleware/validateRequest.js'
import { projectQueries } from '../projects/queries.js'

const params = z.object({ projectId: id })

// Mounted at /api/projects/:projectId/messages. Small enough that queries
// live here; split when threads or attachments arrive.
export function messageRoutes({ db, audit, access }) {
  const projects = projectQueries(db)
  const list = db.prepare(`
    SELECT messages.id, messages.body, messages.created_at AS createdAt, users.name AS author, users.role AS authorRole, users.id = ? AS mine
    FROM messages JOIN users ON users.id = messages.author_id WHERE project_id = ? ORDER BY messages.created_at DESC, messages.id DESC LIMIT ?
  `)
  const insert = db.prepare('INSERT INTO messages (project_id, author_id, body) VALUES (?, ?, ?) RETURNING id, body, created_at AS createdAt')
  const router = Router({ mergeParams: true })
  router.use(authenticate, validateRequest({ params }), access.require())

  router.get('/', validateRequest({ query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }) }), (req, res) => {
    res.json({ messages: list.all(req.user.id, req.project.id, req.query.limit).map((m) => ({ ...m, mine: Boolean(m.mine) })) })
  })

  router.post('/', validateRequest({ body: z.object({ body: z.string().trim().min(1, 'Write something first.').max(2000, 'Keep it under 2,000 characters.') }) }), (req, res) => {
    const message = insert.get(req.project.id, req.user.id, req.body.body)
    projects.touch(req.project.id)
    // No body in the audit trail — the message table is the record.
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'message.posted', entityType: 'message', entityId: message.id })
    res.status(201).json({ message: { ...message, author: req.user.name, authorRole: req.user.role, mine: true } })
  })

  return router
}
