// Errors that carry an HTTP status. Anything thrown without one is a 500 and
// is logged; these are answered as-is and never logged with request bodies.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const notFound = (message = 'Not found.') => new HttpError(404, message)
export const forbidden = (message = 'You do not have access to that.') => new HttpError(403, message)
export const badRequest = (message, details) => new HttpError(400, message, details)
export const unauthorized = (message = 'Authentication required.') => new HttpError(401, message)
