import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { bootApp, seedAdmin, seedClientUser } from './helpers.js'

let app, admin, mara
before(async () => { app = await bootApp(); admin = seedAdmin(app.db); mara = seedClientUser(app.db, { clientName: 'Northstar', email: 'mara@test.local' }) })
after(() => app.close())

test('session bootstrap returns no user and a csrf token', async () => {
  const c = app.client(); const r = await c.get('/auth/session')
  assert.equal(r.status, 200); assert.equal(r.data.user, null); assert.ok(r.data.csrfToken); assert.ok(c.jar.has('rp_csrf'))
})

test('login sets an httpOnly session cookie and /auth/session reports the user', async () => {
  const c = app.client(); const user = await c.login(mara.email, mara.password)
  assert.equal(user.role, 'client'); assert.ok(c.jar.has('rp_session'))
  const r = await c.get('/auth/session'); assert.equal(r.data.user.email, mara.email)
})

test('wrong password and unknown email answer identically', async () => {
  const c = app.client()
  const a = await c.post('/auth/login', { email: mara.email, password: 'not-the-password' })
  const b = await c.post('/auth/login', { email: 'nobody@test.local', password: 'not-the-password' })
  assert.equal(a.status, 401); assert.equal(b.status, 401); assert.deepEqual(a.data, b.data)
})

test('a write without the csrf header is refused even with a valid session', async () => {
  const c = app.client(); await c.login(mara.email, mara.password)
  const r = await fetch(`${app.baseUrl}/auth/session`, { method: 'DELETE', headers: { cookie: `rp_session=${c.jar.get('rp_session')}; rp_csrf=${c.jar.get('rp_csrf')}` } })
  assert.equal(r.status, 403)
})

test('logout revokes the session server-side', async () => {
  const c = app.client(); await c.login(mara.email, mara.password)
  const token = c.jar.get('rp_session')
  assert.equal((await c.del('/auth/session')).status, 204)
  c.jar.set('rp_session', token) // replay the old cookie
  assert.equal((await c.get('/projects')).status, 401)
})

test('disabling a user revokes their sessions immediately', async () => {
  const c = app.client(); await c.login(mara.email, mara.password)
  const a = app.client(); await a.login(admin.email, admin.password)
  assert.equal((await a.patch(`/clients/${mara.clientId}/users/${mara.userId}`, { status: 'disabled' })).status, 200)
  assert.equal((await c.get('/projects')).status, 401)
  assert.equal((await app.client().post('/auth/login', { email: mara.email, password: mara.password })).status, 401)
  await a.patch(`/clients/${mara.clientId}/users/${mara.userId}`, { status: 'active' })
})

test('login is rate limited', async () => {
  const c = app.client(); let last
  for (let i = 0; i < 11; i++) last = await c.post('/auth/login', { email: 'x@test.local', password: 'wrong-password' })
  assert.equal(last.status, 429)
})
