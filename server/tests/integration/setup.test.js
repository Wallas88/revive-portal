import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { loadEnv } from '../../src/config/env.js'
import { openDatabase } from '../../src/db/connection.js'
import { createApp } from '../../src/app.js'
import { httpClient, seedAdmin } from './helpers.js'

async function boot(extraEnv) {
  const env = loadEnv({ NODE_ENV: 'test', UPLOAD_DIR: '/tmp/rp-setup-test', SESSION_HOURS: '1', APP_URL: 'http://portal.test', ...extraEnv })
  const db = openDatabase(':memory:')
  const app = createApp({ db, env, log: { error: () => {} } })
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
  return { db, server, client: () => httpClient(`http://127.0.0.1:${server.address().port}/api`), close: () => new Promise((r) => server.close(() => { db.close(); r() })) }
}

const body = { token: 'correct-horse-battery-staple-token', name: 'Waldo', email: 'waldo@test.local', password: 'a-long-admin-password' }
let withToken, withoutToken
before(async () => { withToken = await boot({ SETUP_TOKEN: body.token }); withoutToken = await boot({}) })
after(async () => { await withToken.close(); await withoutToken.close() })

test('setup is closed without a SETUP_TOKEN, and does not reveal why', async () => {
  const c = withoutToken.client()
  assert.deepEqual((await c.get('/auth/setup')).data, { available: false })
  assert.equal((await c.post('/auth/setup', body)).status, 404)
  assert.equal(withoutToken.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n, 0)
})

test('setup creates the first admin once, with the right token, then closes', async () => {
  const c = withToken.client()
  assert.deepEqual((await c.get('/auth/setup')).data, { available: true })
  assert.equal((await c.post('/auth/setup', { ...body, token: 'wrong-token-of-the-same-length--' })).status, 403)
  assert.equal((await c.post('/auth/setup', { ...body, password: 'short' })).status, 400)
  const created = await c.post('/auth/setup', body)
  assert.equal(created.status, 201); assert.equal(created.data.user.role, 'admin'); assert.ok(c.jar.has('rp_session'))
  assert.equal((await c.get('/clients')).status, 200) // signed in as admin
  // closed from now on — even with the right token
  assert.deepEqual((await withToken.client().get('/auth/setup')).data, { available: false })
  assert.equal((await withToken.client().post('/auth/setup', { ...body, email: 'second@test.local' })).status, 404)
  assert.equal(withToken.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n, 1)
})

test('setup is closed when an admin already exists, regardless of token', async () => {
  const fresh = await boot({ SETUP_TOKEN: body.token }); seedAdmin(fresh.db)
  assert.deepEqual((await fresh.client().get('/auth/setup')).data, { available: false })
  assert.equal((await fresh.client().post('/auth/setup', body)).status, 404)
  await fresh.close()
})
