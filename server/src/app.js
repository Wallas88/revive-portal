import express from 'express'
import helmet from 'helmet'
import { cookies } from './middleware/cookies.js'
import { csrf } from './middleware/csrf.js'
import { sessionLookup, authenticate } from './middleware/authenticate.js'
import { requireAdmin } from './middleware/requireAdmin.js'
import { errorHandler } from './middleware/errorHandler.js'
import { createAudit } from './services/audit.js'
import { createEmail } from './services/email.js'
import { createStorage } from './services/storage.js'
import { projectAccess } from './modules/projects/access.js'
import { authRoutes } from './modules/auth/routes.js'
import { clientRoutes } from './modules/clients/routes.js'
import { projectRoutes } from './modules/projects/routes.js'
import { milestoneRoutes } from './modules/milestones/routes.js'
import { deliverableRoutes } from './modules/deliverables/routes.js'
import { deliverableQueries } from './modules/deliverables/queries.js'
import { messageRoutes } from './modules/messages/routes.js'
import { fileRoutes } from './modules/files/routes.js'

// Wires the API. db is an open, migrated connection; env comes from loadEnv().
export function createApp({ db, env, log = console, email = createEmail(env, { log }), storage = createStorage(env) }) {
  const audit = createAudit(db)
  const access = projectAccess(db)
  const deps = { db, env, audit, email, storage, access, log }
  const app = express()
  app.set('trust proxy', env.production ? 1 : false)
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: env.production ? undefined : false }))
  app.use(express.json({ limit: '64kb' }))
  app.use(cookies)

  const api = express.Router()
  api.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  api.use(csrf({ secure: env.cookieSecure }))
  api.use(sessionLookup(db))

  api.get('/health', (_req, res) => res.json({ status: 'ok' }))
  api.use('/auth', authRoutes(deps))
  api.use('/clients', clientRoutes(deps))
  api.use('/projects', projectRoutes(deps))
  api.use('/projects/:projectId/milestones', milestoneRoutes(deps))
  api.use('/projects/:projectId/messages', messageRoutes(deps))
  api.use('/projects/:projectId/files', fileRoutes(deps))
  api.use('/projects/:projectId', deliverableRoutes(deps))
  // The admin's queue: every decision still waiting, across all projects.
  api.get('/admin/decisions', authenticate, requireAdmin, (_req, res) => res.json({ decisions: deliverableQueries(db).pendingEverywhere() }))

  api.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }))
  app.use('/api', api)
  app.use(errorHandler(log))
  return app
}
