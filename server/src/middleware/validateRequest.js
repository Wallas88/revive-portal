import { z } from 'zod'
import { badRequest } from '../lib/httpError.js'

export const id = z.coerce.number().int().positive()

// validateRequest({ body, params, query }) — each a zod schema. Parsed values
// replace the raw ones so handlers only ever see validated input.
export function validateRequest(schemas) {
  return (req, _res, next) => {
    const fields = {}
    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part] ?? {})
      if (result.success) {
        if (part === 'query') Object.defineProperty(req, 'query', { value: result.data, configurable: true })
        else req[part] = result.data
        continue
      }
      for (const issue of result.error.issues) fields[issue.path.join('.') || part] = issue.message
    }
    if (Object.keys(fields).length) return next(badRequest('Check the highlighted fields.', fields))
    next()
  }
}
