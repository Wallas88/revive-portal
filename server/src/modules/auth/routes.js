import { Router } from 'express'
import { z } from 'zod'
import { authenticate, SESSION_COOKIE } from '../../middleware/authenticate.js'
import { appendCookie, serializeCookie } from '../../middleware/cookies.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { authService, publicUser } from './service.js'

const password = z.string().min(10, 'Use at least 10 characters.').max(128, 'Passwords are limited to 128 characters.')
const emailField = z.email('Enter a valid email address.').max(254)
const tokenParam = z.object({ token: z.string().min(20).max(200) })

export function authRoutes(deps) {
  const { env } = deps
  const service = authService(deps)
  const router = Router()

  const setSessionCookie = (res, session) => appendCookie(res, serializeCookie(SESSION_COOKIE, session.token, { secure: env.cookieSecure, maxAge: session.maxAge }))
  const clearSessionCookie = (res) => appendCookie(res, serializeCookie(SESSION_COOKIE, '', { secure: env.cookieSecure, maxAge: 0 }))

  // Bootstrap: who am I (if anyone) + the CSRF token the client must echo on writes.
  router.get('/session', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null, csrfToken: res.locals.csrfToken }))

  router.post('/login',
    rateLimit({ windowMs: 60_000, max: 10 }),
    validateRequest({ body: z.object({ email: emailField, password: z.string().min(1).max(128) }) }),
    (req, res) => {
      const { user, session } = service.login(req.body.email, req.body.password)
      setSessionCookie(res, session)
      res.json({ user })
    })

  router.delete('/session', authenticate, (req, res) => {
    service.logout(req.sessionId, req.user.id)
    clearSessionCookie(res)
    res.status(204).end()
  })

  router.get('/invitations/:token', rateLimit({ windowMs: 60_000, max: 20 }), validateRequest({ params: tokenParam }), (req, res) => {
    res.json({ invitation: service.inspectInvitation(req.params.token) })
  })

  router.post('/invitations/:token/accept',
    rateLimit({ windowMs: 60_000, max: 10 }),
    validateRequest({ params: tokenParam, body: z.object({ name: z.string().trim().min(2).max(80).optional(), password }) }),
    (req, res) => {
      const { user, session } = service.acceptInvitation(req.params.token, req.body)
      setSessionCookie(res, session)
      res.status(201).json({ user })
    })

  router.post('/password-resets',
    rateLimit({ windowMs: 15 * 60_000, max: 5 }),
    validateRequest({ body: z.object({ email: emailField }) }),
    async (req, res) => {
      await service.requestPasswordReset(req.body.email)
      res.json({ ok: true, message: 'If that address has an account, a reset link is on its way.' })
    })

  router.post('/password-resets/:token',
    rateLimit({ windowMs: 60_000, max: 10 }),
    validateRequest({ params: tokenParam, body: z.object({ password }) }),
    (req, res) => {
      service.completePasswordReset(req.params.token, req.body.password)
      clearSessionCookie(res)
      res.json({ ok: true })
    })

  return router
}
