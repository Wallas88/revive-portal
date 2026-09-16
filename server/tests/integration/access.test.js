import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { bootApp, seedAdmin, seedClientUser, seedProject } from './helpers.js'

// Two clients, one project each. A must never see B's data; neither may act as admin.
let app, admin, alice, bob, projectA, projectB, a, ca, cb
before(async () => {
  app = await bootApp(); admin = seedAdmin(app.db)
  alice = seedClientUser(app.db, { clientName: 'Alpha', email: 'alice@test.local' })
  bob = seedClientUser(app.db, { clientName: 'Beta', email: 'bob@test.local' })
  projectA = seedProject(app.db, { clientId: alice.clientId, memberIds: [alice.userId], name: 'Alpha Site' })
  projectB = seedProject(app.db, { clientId: bob.clientId, memberIds: [bob.userId], name: 'Beta Site' })
  a = app.client(); await a.login(admin.email, admin.password)
  ca = app.client(); await ca.login(alice.email, alice.password)
  cb = app.client(); await cb.login(bob.email, bob.password)
})
after(() => app.close())

test('project lists are scoped to membership; admin sees all', async () => {
  assert.deepEqual((await ca.get('/projects')).data.projects.map((p) => p.name), ['Alpha Site'])
  assert.deepEqual((await cb.get('/projects')).data.projects.map((p) => p.name), ['Beta Site'])
  assert.equal((await a.get('/projects')).data.projects.length, 2)
})

test('a client cannot read another client\'s project, messages, approvals or files', async () => {
  assert.equal((await ca.get(`/projects/${projectB}`)).status, 404)
  assert.equal((await ca.get(`/projects/${projectB}/messages`)).status, 404)
  assert.equal((await ca.get(`/projects/${projectB}/milestones`)).status, 404)
  assert.equal((await ca.get(`/projects/${projectB}/deliverables`)).status, 404)
  assert.equal((await ca.get(`/projects/${projectB}/files`)).status, 404)
  assert.equal((await ca.post(`/projects/${projectB}/messages`, { body: 'hello' })).status, 404)
})

test('a client cannot decide on another client\'s approval request', async () => {
  const d = (await a.post(`/projects/${projectB}/deliverables`, { title: 'Beta homepage' })).data.deliverable
  const v = (await a.post(`/projects/${projectB}/deliverables/${d.id}/versions`, { previewUrl: 'https://example.com/b1' })).data.version
  const r = (await a.post(`/projects/${projectB}/versions/${v.id}/approval-requests`, { message: 'Please review' })).data.request
  assert.equal((await ca.post(`/projects/${projectB}/approval-requests/${r.id}/responses`, { decision: 'approved' })).status, 404)
  // and not by smuggling B's request id under A's own project
  assert.equal((await ca.post(`/projects/${projectA}/approval-requests/${r.id}/responses`, { decision: 'approved' })).status, 404)
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM approval_responses').get().n, 0)
})

test('a client in the same business without a membership still gets nothing', async () => {
  const colleague = app.db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES ('Colleague', 'col@test.local', (SELECT password_hash FROM users WHERE email = 'alice@test.local'), 'client', 'active') RETURNING id").get()
  app.db.prepare('INSERT INTO client_memberships (client_id, user_id) VALUES (?, ?)').run(alice.clientId, colleague.id)
  const cc = app.client(); await cc.login('col@test.local', alice.password)
  assert.deepEqual((await cc.get('/projects')).data.projects, [])
  assert.equal((await cc.get(`/projects/${projectA}`)).status, 404)
})

test('clients attempting admin actions are refused', async () => {
  assert.equal((await ca.get('/clients')).status, 403)
  assert.equal((await ca.post('/clients', { name: 'Sneaky' })).status, 403)
  assert.equal((await ca.post('/projects', { clientId: alice.clientId, name: 'Mine' })).status, 403)
  assert.equal((await ca.patch(`/projects/${projectA}`, { progress: 100 })).status, 403)
  assert.equal((await ca.post(`/projects/${projectA}/milestones`, { title: 'Done' })).status, 403)
  assert.equal((await ca.post(`/projects/${projectA}/deliverables`, { title: 'Self-served' })).status, 403)
  assert.equal((await ca.post(`/projects/${projectA}/members`, { userId: bob.userId })).status, 403)
  assert.equal((await ca.get('/admin/decisions')).status, 403)
  assert.equal((await app.client().get('/clients')).status, 401)
})

test('admin cannot attach a user from another business to a project', async () => {
  assert.equal((await a.post(`/projects/${projectA}/members`, { userId: bob.userId })).status, 400)
})
