import { HttpError } from '../lib/httpError.js'

// Fixed-window counter per key, in memory. Fine for one process; if the
// portal ever runs more than one instance this must move to shared storage.
export function rateLimit({ windowMs, max, keyFn = (req) => req.ip || 'local', message = 'Too many attempts. Try again shortly.' }) {
  const hits = new Map()
  return (req, _res, next) => {
    const now = Date.now()
    const key = keyFn(req)
    let record = hits.get(key)
    if (!record || now > record.reset) record = { count: 0, reset: now + windowMs }
    record.count += 1
    hits.set(key, record)
    if (hits.size > 10_000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k)
    if (record.count > max) return next(new HttpError(429, message))
    next()
  }
}
