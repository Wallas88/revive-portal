import { forbidden, unauthorized } from '../lib/httpError.js'

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized())
  if (req.user.role !== 'admin') return next(forbidden())
  next()
}
