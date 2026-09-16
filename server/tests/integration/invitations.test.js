import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { bootApp, seedAdmin } from './helpers.js'

let app, admin, a, sent = []
before(async () => {
  app = await bootApp({ email: { enabled: true, send: async (m) => { sent.push(m); return { sent: true } } } })
  admin = seedAdmin(app.db); a = app.client(); await a.login(admin.email, admin.password)
})
after(() => app.close())

const tokenFrom = (url) => url.split('/invite/')[1]

test('admin invites a client user; the invite works once and signs them in', async () => {
  const client = (await a.post('/clients', { name: 'Coastal Cafe' })).data.client
  const invited = await a.post(`/clients/${client.id}/users`, { name: 'Lohana V', email: 'lohana@test.local' })
  assert.equal(invited.status, 201); assert.match(invited.data.invitation.url, /^http:\/\/portal\.test\/invite\//); assert.equal(invited.data.invitation.emailed, true)
  assert.equal(sent.at(-1).to, 'lohana@test.local'); assert.ok(!sent.at(-1).text.includes('undefined'))
  const token = tokenFrom(invited.data.invitation.url)

  const c = app.client()
  const peek = await c.get(`/auth/invitations/${token}`); assert.equal(peek.status, 200); assert.equal(peek.data.invitation.email, 'lohana@test.local')
  assert.equal((await c.post(`/auth/invitations/${token}/accept`, { password: 'short' })).status, 400)
  const accepted = await c.post(`/auth/invitations/${token}/accept`, { password: 'a-good-password-1' })
  assert.equal(accepted.status, 201); assert.ok(c.jar.has('rp_session'))
  assert.equal((await c.get('/auth/session')).data.user.email, 'lohana@test.local')

  // single-use
  assert.equal((await app.client().post(`/auth/invitations/${token}/accept`, { password: 'another-password-1' })).status, 410)
  // and the password now works for a fresh login
  assert.equal((await app.client().post('/auth/login', { email: 'lohana@test.local', password: 'a-good-password-1' })).status, 200)
})

test('an expired invitation is refused', async () => {
  const client = (await a.post('/clients', { name: 'Late Ltd' })).data.client
  const invited = await a.post(`/clients/${client.id}/users`, { name: 'Late Person', email: 'late@test.local' })
  app.db.prepare("UPDATE invitations SET expires_at = datetime('now', '-1 day') WHERE user_id = ?").run(invited.data.user.id)
  const token = tokenFrom(invited.data.invitation.url)
  assert.equal((await app.client().get(`/auth/invitations/${token}`)).status, 410)
  assert.equal((await app.client().post(`/auth/invitations/${token}/accept`, { password: 'a-good-password-1' })).status, 410)
  // and the account cannot sign in without a password
  assert.equal((await app.client().post('/auth/login', { email: 'late@test.local', password: 'a-good-password-1' })).status, 401)
})

test('re-issuing an invitation voids the previous link', async () => {
  const client = (await a.post('/clients', { name: 'Twice Co' })).data.client
  const first = await a.post(`/clients/${client.id}/users`, { name: 'Twice', email: 'twice@test.local' })
  const second = await a.post(`/clients/${client.id}/users/${first.data.user.id}/invitations`)
  assert.equal(second.status, 201)
  assert.equal((await app.client().get(`/auth/invitations/${tokenFrom(first.data.invitation.url)}`)).status, 410)
  assert.equal((await app.client().get(`/auth/invitations/${tokenFrom(second.data.invitation.url)}`)).status, 200)
})

test('password reset: link works once, old sessions are revoked', async () => {
  const c = app.client(); await c.login('lohana@test.local', 'a-good-password-1')
  assert.equal((await app.client().post('/auth/password-resets', { email: 'lohana@test.local' })).status, 200)
  assert.equal((await app.client().post('/auth/password-resets', { email: 'nobody@test.local' })).status, 200) // no enumeration
  const token = sent.at(-1).text.split('/reset/')[1].split('\n')[0]
  assert.equal((await app.client().post(`/auth/password-resets/${token}`, { password: 'a-new-password-22' })).status, 200)
  assert.equal((await c.get('/projects')).status, 401)
  assert.equal((await app.client().post(`/auth/password-resets/${token}`, { password: 'a-new-password-33' })).status, 410)
  assert.equal((await app.client().post('/auth/login', { email: 'lohana@test.local', password: 'a-new-password-22' })).status, 200)
})
