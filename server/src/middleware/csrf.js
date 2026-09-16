import { createCsrfToken } from '../lib/tokens.js'
import { appendCookie, serializeCookie } from './cookies.js'
import { HttpError } from '../lib/httpError.js'

export const CSRF_COOKIE = 'rp_csrf'
export const CSRF_HEADER = 'x-csrf-token'
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

// Double-submit token: a readable cookie the browser sends back in a header
// on every write. A cross-site form can send the cookie, not the header.
export function csrf({ secure }) {
  return (req, res, next) => {
    let token = req.cookies[CSRF_COOKIE]
    if (!token) {
      token = createCsrfToken()
      appendCookie(res, serializeCookie(CSRF_COOKIE, token, { httpOnly: false, secure, maxAge: 60 * 60 * 24 * 30 }))
    }
    res.locals.csrfToken = token
    if (SAFE.has(req.method)) return next()
    const sent = req.headers[CSRF_HEADER]
    if (!sent || sent !== req.cookies[CSRF_COOKIE]) return next(new HttpError(403, 'The request could not be verified. Reload the page and try again.'))
    next()
  }
}
