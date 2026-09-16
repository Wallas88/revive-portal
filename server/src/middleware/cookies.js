// Minimal cookie handling — two cookies, no dependency needed.
export function parseCookies(header = '') {
  const jar = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const name = part.slice(0, index).trim()
    if (name) jar[name] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return jar
}

export function cookies(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie)
  next()
}

export function serializeCookie(name, value, { maxAge, httpOnly = true, secure, path = '/', sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`]
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${Math.floor(maxAge)}`)
  if (httpOnly) parts.push('HttpOnly')
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function appendCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', existing ? [].concat(existing, cookie) : cookie)
}
