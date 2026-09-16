import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { id, validateRequest } from '../../middleware/validateRequest.js'
import { notFound } from '../../lib/httpError.js'
import { milestoneQueries } from './queries.js'
import { projectQueries } from '../projects/queries.js'

const state = z.enum(['complete', 'active', 'upcoming'])
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').nullable().optional()
const body = z.object({ title: z.string().trim().min(2).max(120), state: state.default('upcoming'), position: z.coerce.number().int().min(0).optional(), dueDate: dateField, note: z.string().trim().max(600).optional() })
const params = z.object({ projectId: id })
const itemParams = params.extend({ milestoneId: id })

// Mounted at /api/projects/:projectId/milestones. Reads for members, writes for admin.
export function milestoneRoutes({ db, audit, access }) {
  const q = milestoneQueries(db)
  const projects = projectQueries(db)
  const router = Router({ mergeParams: true })
  router.use(authenticate, validateRequest({ params }), access.require())

  router.get('/', (req, res) => res.json({ milestones: q.list(req.project.id) }))

  router.post('/', requireAdmin, validateRequest({ body }), (req, res) => {
    const position = req.body.position ?? q.nextPosition(req.project.id)
    const { id: milestoneId } = q.insert(req.project.id, { ...req.body, position })
    projects.touch(req.project.id)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'milestone.created', entityType: 'milestone', entityId: milestoneId, meta: { title: req.body.title } })
    res.status(201).json({ milestone: q.get(req.project.id, milestoneId) })
  })

  router.patch('/:milestoneId', requireAdmin, validateRequest({ params: itemParams, body: body.partial() }), (req, res) => {
    const before = q.get(req.project.id, req.params.milestoneId)
    if (!before) throw notFound('Milestone not found.')
    q.update(req.project.id, before.id, req.body)
    projects.touch(req.project.id)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'milestone.updated', entityType: 'milestone', entityId: before.id, meta: { title: before.title, ...(req.body.state && req.body.state !== before.state ? { from: before.state, to: req.body.state } : {}) } })
    res.json({ milestone: q.get(req.project.id, before.id) })
  })

  router.delete('/:milestoneId', requireAdmin, validateRequest({ params: itemParams }), (req, res) => {
    const before = q.get(req.project.id, req.params.milestoneId)
    if (!before) throw notFound('Milestone not found.')
    q.remove(req.project.id, before.id)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'milestone.deleted', entityType: 'milestone', entityId: before.id, meta: { title: before.title } })
    res.status(204).end()
  })

  return router
}
