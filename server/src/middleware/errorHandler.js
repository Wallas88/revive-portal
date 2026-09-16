import { HttpError } from '../lib/httpError.js'

// Answers HttpErrors as-is; anything else is a 500. Logs never include
// request bodies, cookies or tokens — just where it happened.
export function errorHandler(log = console) {
  return (error, req, res, _next) => {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, ...(error.details ? { fields: error.details } : {}) })
    }
    if (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'That upload is too large.' })
    }
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body could not be read.' })
    log.error(`[${req.method} ${req.path}] ${error?.name || 'Error'}: ${error?.message}`)
    res.status(500).json({ error: 'Something went wrong.' })
  }
}
