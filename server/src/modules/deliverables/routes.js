import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { id, validateRequest } from '../../middleware/validateRequest.js'
import { HttpError, badRequest, forbidden, notFound } from '../../lib/httpError.js'
import { deliverableQueries } from './queries.js'
import { projectQueries } from '../projects/queries.js'

const params = z.object({ projectId: id })
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').nullable().optional()
const httpUrl = z.url().max(500).refine((u) => /^https?:\/\//i.test(u), 'Preview links must start with http:// or https://')

// Mounted at /api/projects/:projectId — deliverables, their versions, and
// the approval requests/decisions that hang off an exact version.
export function deliverableRoutes({ db, audit, access }) {
  const q = deliverableQueries(db)
  const projects = projectQueries(db)
  const router = Router({ mergeParams: true })
  router.use(authenticate, validateRequest({ params }), access.require())

  router.get('/deliverables', (req, res) => res.json({ deliverables: q.listWithVersions(req.project.id) }))

  router.post('/deliverables', requireAdmin,
    validateRequest({ body: z.object({ title: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional() }) }),
    (req, res) => {
      const { id: deliverableId } = q.insert(req.project.id, req.body, req.user.id)
      projects.touch(req.project.id)
      audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'deliverable.created', entityType: 'deliverable', entityId: deliverableId, meta: { title: req.body.title } })
      res.status(201).json({ deliverable: q.listWithVersions(req.project.id).find((d) => d.id === deliverableId) })
    })

  // A new version starts with no approval — by construction, never inherited.
  router.post('/deliverables/:deliverableId/versions', requireAdmin,
    validateRequest({ params: params.extend({ deliverableId: id }), body: z.object({ note: z.string().trim().max(1000).optional(), previewUrl: httpUrl.nullable().optional(), fileId: id.nullable().optional() }) }),
    (req, res) => {
      const deliverable = q.get(req.project.id, req.params.deliverableId)
      if (!deliverable) throw notFound('Deliverable not found.')
      if (!req.body.previewUrl && !req.body.fileId) throw badRequest('Check the highlighted fields.', { previewUrl: 'Add a preview link or attach a file.' })
      if (req.body.fileId && !q.fileInProject(req.project.id, req.body.fileId)) throw badRequest('Check the highlighted fields.', { fileId: 'That file is not part of this project.' })
      const version = q.insertVersion(deliverable.id, req.body, req.user.id)
      projects.touch(req.project.id)
      audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'deliverable.version_added', entityType: 'deliverable_version', entityId: version.id, meta: { title: deliverable.title, version: version.versionNumber } })
      res.status(201).json({ version: q.listWithVersions(req.project.id).find((d) => d.id === deliverable.id).versions.find((v) => v.id === version.id) })
    })

  // Ask the client to decide on this exact version.
  router.post('/versions/:versionId/approval-requests', requireAdmin,
    validateRequest({ params: params.extend({ versionId: id }), body: z.object({ message: z.string().trim().max(1000).optional(), dueDate: dateField }) }),
    (req, res) => {
      const version = q.versionInProject(req.project.id, req.params.versionId)
      if (!version) throw notFound('Version not found.')
      if (q.openRequestForVersion(version.id)) throw new HttpError(409, 'This version already has a decision pending.')
      const { id: requestId } = q.insertRequest(version.id, req.body, req.user.id)
      projects.touch(req.project.id)
      audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'approval.requested', entityType: 'approval_request', entityId: requestId, meta: { title: version.deliverableTitle, version: version.versionNumber } })
      res.status(201).json({ request: q.requestInProject(req.project.id, requestId) })
    })

  // The client's decision. Recorded as a response row; the request's status
  // follows it. Admins do not decide on the client's behalf.
  router.post('/approval-requests/:requestId/responses',
    validateRequest({ params: params.extend({ requestId: id }), body: z.object({ decision: z.enum(['approved', 'changes_requested']), feedback: z.string().trim().max(2000).optional() }) }),
    (req, res) => {
      if (req.user.role !== 'client') throw forbidden('Only the client can approve or request changes.')
      const request = q.requestInProject(req.project.id, req.params.requestId)
      if (!request) throw notFound('Approval request not found.')
      if (request.status !== 'pending') throw new HttpError(409, 'This request has already been decided.')
      if (req.body.decision === 'changes_requested' && !req.body.feedback) throw badRequest('Check the highlighted fields.', { feedback: 'Tell us what should change.' })
      db.exec('BEGIN')
      try {
        q.insertResponse(request.id, req.body, req.user.id)
        q.resolveRequest(request.id, req.body.decision)
        projects.touch(req.project.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      audit.record({ actorId: req.user.id, projectId: req.project.id, action: `approval.${req.body.decision}`, entityType: 'approval_request', entityId: request.id, meta: { title: request.deliverableTitle, version: request.versionNumber } })
      res.status(201).json({ request: q.requestInProject(req.project.id, request.id), responses: q.responses(request.id) })
    })

  router.post('/approval-requests/:requestId/withdraw', requireAdmin, validateRequest({ params: params.extend({ requestId: id }) }), (req, res) => {
    const request = q.requestInProject(req.project.id, req.params.requestId)
    if (!request) throw notFound('Approval request not found.')
    if (request.status !== 'pending') throw new HttpError(409, 'Only a pending request can be withdrawn.')
    q.resolveRequest(request.id, 'withdrawn')
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'approval.withdrawn', entityType: 'approval_request', entityId: request.id, meta: { title: request.deliverableTitle, version: request.versionNumber } })
    res.json({ request: q.requestInProject(req.project.id, request.id) })
  })

  return router
}
