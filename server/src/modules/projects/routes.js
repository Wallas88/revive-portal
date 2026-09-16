import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { id, validateRequest } from '../../middleware/validateRequest.js'
import { badRequest, notFound } from '../../lib/httpError.js'
import { projectQueries } from './queries.js'
import { milestoneQueries } from '../milestones/queries.js'
import { deliverableQueries } from '../deliverables/queries.js'

const status = z.enum(['discovery', 'design', 'build', 'review', 'complete'])
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').nullable().optional()
const projectBody = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(600).default(''),
  status: status.default('discovery'),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  targetDate: dateField,
})

export function projectRoutes({ db, audit, access }) {
  const q = projectQueries(db)
  const milestones = milestoneQueries(db)
  const deliverables = deliverableQueries(db)
  const router = Router()
  router.use(authenticate)

  router.get('/', (req, res) => res.json({ projects: q.listFor(req.user) }))

  // Everything a project page needs in one round trip, scoped to the viewer.
  router.get('/:projectId', validateRequest({ params: z.object({ projectId: id }) }), access.require(), (req, res) => {
    const project = req.project
    res.json({
      project,
      milestones: milestones.list(project.id),
      deliverables: deliverables.listWithVersions(project.id),
      pendingApprovals: deliverables.pendingRequests(project.id),
      members: req.user.role === 'admin' ? q.members(project.id) : undefined,
      activity: audit.forProject(project.id, 30),
    })
  })

  // ---- admin ----
  router.post('/', requireAdmin, validateRequest({ body: projectBody.extend({ clientId: id }) }), (req, res) => {
    if (!db.prepare('SELECT 1 FROM clients WHERE id = ?').get(req.body.clientId)) throw notFound('Client not found.')
    const { id: projectId } = q.insert(req.body)
    audit.record({ actorId: req.user.id, projectId, action: 'project.created', entityType: 'project', entityId: projectId })
    res.status(201).json({ project: access.find(req.user, projectId) })
  })

  router.patch('/:projectId', requireAdmin, validateRequest({ params: z.object({ projectId: id }), body: projectBody.partial() }), access.require(), (req, res) => {
    q.update(req.project.id, req.body)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'project.updated', entityType: 'project', entityId: req.project.id, meta: { fields: Object.keys(req.body) } })
    res.json({ project: access.find(req.user, req.project.id) })
  })

  router.post('/:projectId/members', requireAdmin, validateRequest({ params: z.object({ projectId: id }), body: z.object({ userId: id }) }), access.require(), (req, res) => {
    if (!q.userBelongsToClient(req.body.userId, req.project.clientId)) throw badRequest('That person does not belong to this project\'s client.')
    q.addMember(req.project.id, req.body.userId)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'project.member_added', entityType: 'user', entityId: req.body.userId })
    res.status(201).json({ members: q.members(req.project.id) })
  })

  router.delete('/:projectId/members/:userId', requireAdmin, validateRequest({ params: z.object({ projectId: id, userId: id }) }), access.require(), (req, res) => {
    q.removeMember(req.project.id, req.params.userId)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'project.member_removed', entityType: 'user', entityId: req.params.userId })
    res.json({ members: q.members(req.project.id) })
  })

  return router
}
