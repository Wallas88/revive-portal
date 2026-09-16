// The one place the browser talks to the API. Cookies carry the session;
// every write echoes the CSRF cookie in a header. Errors come back typed so
// forms can show field messages.
export class ApiError extends Error {
  constructor(status, message, fields = {}) { super(message); this.status = status; this.fields = fields }
}

const readCookie = (name) => document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.split('=').slice(1).join('=')

async function request(method, path, { body, form } = {}) {
  const headers = {}
  const csrf = readCookie('rp_csrf')
  if (csrf) headers['x-csrf-token'] = decodeURIComponent(csrf)
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  let response
  try {
    response = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'Could not reach the portal. Check your connection and try again.')
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.error || 'The request could not be completed.', data.fields)
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
  upload: (path, form) => request('POST', path, { form }),
}
