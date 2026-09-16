// Boots the API on an in-memory database with a throwaway upload dir and
// gives each test a cookie-aware client that handles CSRF automatically.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnv } from '../../src/config/env.js'
import { openDatabase } from '../../src/db/connection.js'
import { createApp } from '../../src/app.js'
import { hashPassword } from '../../src/lib/tokens.js'

export async function bootApp({ email } = {}) {
  const uploadDir = mkdtempSync(join(tmpdir(), 'rp-uploads-'))
  const env = loadEnv({ NODE_ENV: 'test', UPLOAD_DIR: uploadDir, SESSION_HOURS: '1', APP_URL: 'http://portal.test' })
  const db = openDatabase(':memory:')
  const app = createApp({ db, env, log: { error: () => {} }, email })
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`
  return {
    db, env, baseUrl,
    client: () => httpClient(baseUrl),
    async close() { await new Promise((r) => server.close(r)); db.close(); rmSync(uploadDir, { recursive: true, force: true }) },
  }
}

export function httpClient(baseUrl) {
  const jar = new Map()
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  async function request(method, path, { body, form, headers = {} } = {}) {
    if (!jar.has('rp_csrf') && !['GET', 'HEAD'].includes(method)) await request('GET', '/auth/session')
    const h = { ...headers, cookie: cookieHeader() }
    if (jar.has('rp_csrf')) h['x-csrf-token'] = jar.get('rp_csrf')
    let payload
    if (form) payload = form
    else if (body !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(body) }
    const response = await fetch(baseUrl + path, { method, headers: h, body: payload, redirect: 'manual' })
    for (const c of response.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = c.split(';'); const [k, v] = pair.split('=')
      if (attrs.some((a) => a.trim() === 'Max-Age=0')) jar.delete(k.trim()); else jar.set(k.trim(), decodeURIComponent(v))
    }
    const type = response.headers.get('content-type') || ''
    const data = type.includes('application/json') ? await response.json() : await response.arrayBuffer()
    return { status: response.status, data, headers: response.headers }
  }
  return {
    jar,
    get: (p, o) => request('GET', p, o), post: (p, body, o) => request('POST', p, { ...o, body }),
    patch: (p, body, o) => request('PATCH', p, { ...o, body }), del: (p, o) => request('DELETE', p, o),
    upload: (p, form) => request('POST', p, { form }),
    async login(email, password) { const r = await request('POST', '/auth/login', { body: { email, password } }); if (r.status !== 200) throw new Error(`login failed: ${r.status} ${JSON.stringify(r.data)}`); return r.data.user },
    forgetSession: () => jar.delete('rp_session'),
  }
}

// ---- seed helpers (write straight to the db; tests exercise the API) ----
export function seedAdmin(db, { email = 'admin@test.local', password = 'admin-password-1', name = 'Admin' } = {}) {
  const row = db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active') RETURNING id").get(name, email, hashPassword(password))
  return { id: row.id, email, password }
}

export function seedClientUser(db, { clientName, email, password = 'client-password-1', name = 'Client User', status = 'active' }) {
  const client = db.prepare('INSERT INTO clients (name) VALUES (?) RETURNING id').get(clientName)
  const user = db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'client', ?) RETURNING id").get(name, email, status === 'active' ? hashPassword(password) : null, status)
  db.prepare('INSERT INTO client_memberships (client_id, user_id) VALUES (?, ?)').run(client.id, user.id)
  return { clientId: client.id, userId: user.id, email, password }
}

export function seedProject(db, { clientId, memberIds = [], name = 'Test Project' }) {
  const project = db.prepare("INSERT INTO projects (client_id, name, summary, status, progress) VALUES (?, ?, 'Summary', 'build', 40) RETURNING id").get(clientId, name)
  for (const userId of memberIds) db.prepare('INSERT INTO project_memberships (project_id, user_id) VALUES (?, ?)').run(project.id, userId)
  return project.id
}
