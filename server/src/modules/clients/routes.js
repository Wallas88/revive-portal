import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { id, validateRequest } from '../../middleware/validateRequest.js'
import { badRequest, notFound } from '../../lib/httpError.js'
import { authQueries } from '../auth/queries.js'
import { authService } from '../auth/service.js'
import { clientQueries } from './queries.js'

const clientParam = z.object({ clientId: id })

// Admin only: the businesses, their people, and invitations.
export function clientRoutes(deps) {
  const { db, audit } = deps
  const q = clientQueries(db)
  const auth = authService(deps)
  const authQ = authQueries(db)
  const router = Router()
  router.use(authenticate, requireAdmin)

  router.get('/', (_req, res) => res.json({ clients: q.list() }))

  router.post('/', validateRequest({ body: z.object({ name: z.string().trim().min(2).max(120) }) }), (req, res) => {
    const { id: clientId } = q.insert(req.body.name)
    audit.record({ actorId: req.user.id, action: 'client.created', entityType: 'client', entityId: clientId })
    res.status(201).json({ client: q.get(clientId) })
  })

  router.get('/:clientId', validateRequest({ params: clientParam }), (req, res) => {
    const client = q.get(req.params.clientId)
    if (!client) throw notFound('Client not found.')
    res.json({ client, users: q.users(client.id), projects: q.projects(client.id) })
  })

  router.patch('/:clientId', validateRequest({ params: clientParam, body: z.object({ name: z.string().trim().min(2).max(120) }) }), (req, res) => {
    if (!q.get(req.params.clientId)) throw notFound('Client not found.')
    q.rename(req.params.clientId, req.body.name)
    res.json({ client: q.get(req.params.clientId) })
  })

  // Add a person to a client and hand back their invitation link. The link
  // is emailed too when a transport is configured.
  router.post('/:clientId/users',
    validateRequest({ params: clientParam, body: z.object({ name: z.string().trim().min(2).max(80), email: z.email().max(254) }) }),
    async (req, res) => {
      const client = q.get(req.params.clientId)
      if (!client) throw notFound('Client not found.')
      const existing = q.userByEmail(req.body.email)
      let userId
      if (existing) {
        if (q.isMember(client.id, existing.id)) throw badRequest('Check the highlighted fields.', { email: 'That person is already on this client.' })
        if (existing.status !== 'invited') throw badRequest('Check the highlighted fields.', { email: 'That email already has an account; add them to a project instead.' })
        userId = existing.id
      } else {
        userId = q.insertUser(req.body).id
      }
      q.addMembership(client.id, userId)
      const invitation = auth.createInvitation(userId, req.user.id)
      const user = q.userById(userId)
      const emailed = await auth.deliverInvitation(user, invitation)
      audit.record({ actorId: req.user.id, action: 'client.user_added', entityType: 'user', entityId: userId, meta: { clientId: client.id, emailed } })
      res.status(201).json({ user, invitation: { url: invitation.url, expiresInDays: invitation.expiresInDays, emailed } })
    })

  // Re-issue an invitation (voids the previous one).
  router.post('/:clientId/users/:userId/invitations', validateRequest({ params: clientParam.extend({ userId: id }) }), async (req, res) => {
    const user = q.userById(req.params.userId)
    if (!user || !q.isMember(req.params.clientId, user.id)) throw notFound('User not found.')
    if (user.status === 'disabled') throw badRequest('This account is disabled.')
    const invitation = auth.createInvitation(user.id, req.user.id)
    const emailed = await auth.deliverInvitation(user, invitation)
    res.status(201).json({ invitation: { url: invitation.url, expiresInDays: invitation.expiresInDays, emailed } })
  })

  // Disable/enable a client user; disabling revokes every session.
  router.patch('/:clientId/users/:userId', validateRequest({ params: clientParam.extend({ userId: id }), body: z.object({ status: z.enum(['active', 'disabled']) }) }), (req, res) => {
    const user = q.userById(req.params.userId)
    if (!user || !q.isMember(req.params.clientId, user.id)) throw notFound('User not found.')
    if (req.body.status === 'active' && user.status === 'invited') throw badRequest('This person has not accepted their invitation yet.')
    q.setStatus(user.id, req.body.status)
    if (req.body.status === 'disabled') authQ.revokeAllSessions(user.id)
    audit.record({ actorId: req.user.id, action: `user.${req.body.status}`, entityType: 'user', entityId: user.id })
    res.json({ user: q.userById(user.id) })
  })

  return router
}
